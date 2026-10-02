/**
 * Sharing an analysis by link. The analyst puts the .strata file online
 * anywhere a browser may read it (their own site, a GitHub repository or
 * Gist, Dropbox, OneDrive, or Google Drive where set up), and a Strata link
 * carries its address: `?src=<file address>`. Opening
 * the link fetches the file and shows it in the reading view. No Strata server
 * stores anything. docs/decisions.md, "Sharing by Link".
 */
import type { StrataDocument } from '@/types/strata'
import { readStrataFile } from '@/lib/fileIO'
import type { LoadResult } from '@/lib/documentLoad'
import { formSpans } from '@/lib/layers'

/** The link that opens `fileUrl` in Strata's reading view. */
export function shareUrl(fileUrl: string, base: string): string {
  const u = new URL(base)
  u.search = ''
  u.hash = ''
  u.searchParams.set('src', fileUrl.trim())
  return u.toString()
}

/** The shared file's address in a page URL, if any (http or https only). */
export function srcParam(pageUrl: string): string | null {
  const src = new URL(pageUrl).searchParams.get('src')
  if (!src) return null
  try {
    const u = new URL(src)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

// ── Where the file lives ────────────────────────────────────────────────────

export type FileHost = 'github' | 'dropbox' | 'onedrive' | 'gdrive' | 'web'

/** Which service a pasted file address belongs to. */
export function fileHost(url: string): FileHost {
  let host: string
  try {
    host = new URL(url.trim()).hostname
  } catch {
    return 'web'
  }
  if (host === 'github.com') return 'github'
  if (host === 'www.dropbox.com' || host === 'dropbox.com') return 'dropbox'
  if (host === '1drv.ms' || host === 'onedrive.live.com') return 'onedrive'
  if (host === 'drive.google.com') return 'gdrive'
  return 'web'
}

/** A Google Drive file id from its share link (…/file/d/ID/view, or ?id=ID). */
export function driveFileId(url: string): string | null {
  const m = /\/file\/d\/([\w-]+)/.exec(url) ?? /[?&]id=([\w-]+)/.exec(url)
  return m ? m[1] : null
}

/** base64url, as OneDrive's sharing API wants a share link encoded. */
function base64Url(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * The address that returns the file itself for a pasted share link, since a
 * service's own page link returns a web page:
 *   - GitHub: github.com/o/r/blob/main/a.strata → raw.githubusercontent.com/o/r/main/a.strata
 *   - Dropbox: www.dropbox.com/… → dl.dropboxusercontent.com/…, which lets
 *     other sites read the file
 *   - OneDrive: a 1drv.ms or onedrive.live.com link → the OneDrive sharing
 *     API's download address for it
 *   - Google Drive: only through Google's Drive API, which needs an API key
 *     (`googleApiKey`); without one, null.
 * Any other address is used as it is.
 */
export function rawFileUrl(url: string, googleApiKey?: string): string | null {
  const u = url.trim()
  switch (fileHost(u)) {
    case 'github': {
      const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(u)
      return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : u
    }
    case 'dropbox': {
      const d = new URL(u)
      d.hostname = 'dl.dropboxusercontent.com'
      d.searchParams.delete('dl')
      return d.toString()
    }
    case 'onedrive':
      return `https://api.onedrive.com/v1.0/shares/u!${base64Url(u)}/root/content`
    case 'gdrive': {
      const id = driveFileId(u)
      if (!id || !googleApiKey) return null
      return `https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${encodeURIComponent(googleApiKey)}`
    }
    default:
      return u
  }
}

/** The Google API key Strata is built with, if any (for Drive links). */
const GOOGLE_API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_API_KEY || undefined

/** Whether links to this host can be opened by this build of Strata. */
export function hostSupported(host: FileHost): boolean {
  return host !== 'gdrive' || !!GOOGLE_API_KEY
}

/** Fetch and read a shared file, with errors written for the reader. */
export async function fetchSharedAnalysis(url: string): Promise<LoadResult> {
  const host = fileHost(url)
  const address = rawFileUrl(url, GOOGLE_API_KEY)
  if (!address) {
    throw new Error(
      host === 'gdrive'
        ? 'Google Drive links can’t be opened by this copy of Strata yet. Dropbox, OneDrive, GitHub and most websites work.'
        : 'This doesn’t look like a link to a file.',
    )
  }
  let res: Response
  try {
    res = await fetch(address)
  } catch {
    throw new Error(
      host === 'onedrive'
        ? 'OneDrive didn’t let the browser read the file. Check the link is shared as “Anyone with the link”, or try Dropbox or GitHub.'
        : 'The browser could not fetch the file. Its host may not allow other sites to read it (CORS); GitHub, Gist and Dropbox links do.',
    )
  }
  if (!res.ok) {
    throw new Error(
      res.status === 403 || res.status === 404 || res.status === 401
        ? `The file could not be fetched (the server answered ${res.status}). Check it is shared publicly, with anyone who has the link.`
        : `The file could not be fetched (the server answered ${res.status}).`,
    )
  }
  return readStrataFile(await res.text())
}

/** Whether any span carries lyrics. */
export function hasLyrics(doc: StrataDocument): boolean {
  return doc.layers.some((l) => formSpans(l).some((s) => s.lyrics))
}

/** A copy with every span's lyrics removed, for sharing without them. */
export function withoutLyrics(doc: StrataDocument): StrataDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.type === 'form-diagram' ? { ...l, data: { ...l.data, spans: formSpans(l).map((s) => ({ ...s, lyrics: null })) } } : l,
    ),
  }
}
