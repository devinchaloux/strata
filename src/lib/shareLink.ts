/**
 * Sharing an analysis by link. The analyst puts the .strata file online
 * anywhere a browser may read it (their own site, a GitHub repository or
 * Gist, Dropbox, OneDrive or Google Drive), and a Strata link
 * carries its address: `?src=<file address>`. Opening
 * the link fetches the file and shows it in the reading view. No Strata server
 * stores anything; Drive files pass through Strata's Drive-only reader
 * (api/drive.ts). docs/decisions.md, "Sharing by Link".
 */
import { readStrataFile } from '@/lib/fileIO'
import type { LoadResult } from '@/lib/documentLoad'

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

/**
 * The file id in a Google Drive link: drive.google.com/file/d/<id>/view,
 * /open?id=<id> or /uc?id=<id>. Null when there is none (a folder, say).
 */
export function driveFileId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  const id = /^\/file\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1] ?? (u.pathname === '/open' || u.pathname === '/uc' ? u.searchParams.get('id') : null)
  return id && /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : null
}

/** Strata's own reader for a Drive file (api/drive.ts), which holds the API key. */
export const DRIVE_READER = '/api/drive'

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
 *   - Google Drive: Strata's Drive reader for the file's id (a same-site
 *     address), since Drive lets other sites read a file only through its
 *     API with a key, and the key stays on the server; null for a Drive link
 *     with no file id
 * Any other address is used as it is.
 */
export function rawFileUrl(url: string): string | null {
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
      return id ? `${DRIVE_READER}?id=${id}` : null
    }
    default:
      return u
  }
}

/** Whether Strata can open this link (a Drive link needs a file id). */
export function hostSupported(url: string): boolean {
  return rawFileUrl(url) !== null
}

/** Fetch and read a shared file, with errors written for the reader. */
export async function fetchSharedAnalysis(url: string): Promise<LoadResult> {
  const host = fileHost(url)
  const address = rawFileUrl(url)
  if (!address) {
    throw new Error(
      host === 'gdrive'
        ? 'This Google Drive link doesn’t point to a file. Open the file in Drive, choose Share, and copy its link.'
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
    // The Drive reader says what went wrong in words for the reader.
    if (host === 'gdrive') {
      const said = await res.json().catch(() => null) as { error?: unknown } | null
      if (typeof said?.error === 'string') throw new Error(said.error)
    }
    throw new Error(
      res.status === 403 || res.status === 404 || res.status === 401
        ? `The file could not be fetched (the server answered ${res.status}). Check that it’s shared with anyone who has the link.`
        : `The file could not be fetched (the server answered ${res.status}).`,
    )
  }
  return readStrataFile(await res.text())
}
