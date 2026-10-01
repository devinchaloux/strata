/**
 * Sharing an analysis by link. The analyst puts the .strata file online
 * anywhere a browser may read it (their own site, a GitHub repository or
 * Gist), and a Strata link carries its address: `?src=<file address>`. Opening
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

/**
 * Read a GitHub page link as the raw file it shows, since only the raw address
 * returns the file itself: github.com/o/r/blob/main/a.strata →
 * raw.githubusercontent.com/o/r/main/a.strata.
 */
export function rawFileUrl(url: string): string {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url.trim())
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : url.trim()
}

/** Fetch and read a shared file, with errors written for the reader. */
export async function fetchSharedAnalysis(url: string): Promise<LoadResult> {
  let res: Response
  try {
    res = await fetch(rawFileUrl(url))
  } catch {
    throw new Error(
      'The browser could not fetch the file. Its host may not allow other sites to read it (CORS); GitHub and Gist raw links do.',
    )
  }
  if (!res.ok) throw new Error(`The file could not be fetched (the server answered ${res.status}).`)
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
