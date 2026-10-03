/**
 * Starting a new analysis from a link: `?new&title=…&artist=…&video=…&bpm=…
 * &key=…&mode=…&author=…`. Another tool that already knows the track (a catalogue, a
 * course page) can open Strata with the setup filled in; the analyst checks it
 * in the New analysis dialog, which opens as usual. Nothing is saved anywhere
 * until they save. docs/decisions.md, "Starting an Analysis from a Link".
 *
 * Every field is optional, and one that doesn't read is left out rather than
 * refused: a link with a bad tempo still starts the analysis.
 */
import type { HomeKey, StrataDocument } from '@/types/strata'
import { BUILT_IN_MODES } from '@/lib/modes'
import { toAccidentals } from '@/lib/musicSymbols'
import { canonicalYouTubeUrl, parseYouTubeInput } from '@/lib/youtube'

export interface NewFromLink {
  title?: string
  artist: string[]
  /** A YouTube link, in its canonical form. */
  video?: string
  bpm?: number
  homeKey?: HomeKey
  /** The analysis author, for the document's credit. */
  author?: string
}

/** What a `?new` address asks for, or null when it isn't one. */
export function parseNewParams(pageUrl: string): NewFromLink | null {
  const p = new URL(pageUrl).searchParams
  if (!p.has('new')) return null
  const out: NewFromLink = { artist: [] }

  const title = p.get('title')?.trim()
  if (title) out.title = title.slice(0, 300)
  // Several artists as several `artist` parameters, in order.
  out.artist = p.getAll('artist').map((a) => a.trim()).filter(Boolean).slice(0, 20)

  const video = p.get('video')
  const id = video ? parseYouTubeInput(video) : null
  if (id) out.video = canonicalYouTubeUrl(id)

  const bpm = Number(p.get('bpm'))
  if (Number.isFinite(bpm) && bpm > 0 && bpm < 400) out.bpm = Math.round(bpm * 100) / 100

  // A tonic is the analyst's spelling, so it is taken as written; a mode must
  // be one Strata knows.
  const tonic = p.get('key')?.trim() ?? ''
  const modeParam = p.get('mode')?.trim().toLowerCase() ?? ''
  const mode = BUILT_IN_MODES.some((m) => m.id === modeParam) ? modeParam : null
  if (tonic || mode) out.homeKey = { tonic: toAccidentals(tonic).slice(0, 12), mode }

  const author = p.get('author')?.trim()
  if (author) out.author = author.slice(0, 200)

  return out
}

/** A new document with what the link gives filled in. */
export function applyNewFromLink(doc: StrataDocument, n: NewFromLink): StrataDocument {
  return {
    ...doc,
    ...(n.title ? { title: n.title } : {}),
    ...(n.artist.length ? { artist: n.artist } : {}),
    ...(n.video ? { source: { ...doc.source, type: 'youtube' as const, url: n.video } } : {}),
    ...(n.bpm !== undefined ? { bpm: n.bpm } : {}),
    ...(n.homeKey ? { homeKey: n.homeKey } : {}),
    ...(n.author ? { analysisAuthor: n.author } : {}),
  }
}
