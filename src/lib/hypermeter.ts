/**
 * Hypermeter: hyperbeats counted 1, 2, 3, 4, 1 … in groups.
 *
 * The analyst counts bars (or spans at any level) to show hypermeter. Fill
 * from grid fills the empty bar layer, one span per bar of the beat grid;
 * Count recounts a run of selected bars from 1, so a phrase of 3 or 6 in the
 * middle of fours is one press; Elide turns one bar into "4=1", the bar that
 * ends one group and begins the next, and counts on from 2 after it. Counts
 * are each span's own field (Span.hypermeter), drawn centered inside the
 * shape, apart from its annotation, which a count never touches. The analyst
 * can edit any of them by hand. docs/decisions.md, "Numbering Hypermeter",
 * "The Bar Layer" and "The Hypermeter Is Its Own Field".
 *
 * Pure functions; the store (documentStore numberBars, renumberSpans,
 * elideSpan, setBarLayer, numberBarLayer, countBars, elideGroupBoundary)
 * applies them.
 */
import type { GridSegment, Hypermeter, Layer, Span } from '@/types/strata'
import { barLength, gridLines, segmentAt, segmentEnd } from '@/lib/beatGrid'

/** The group size a count starts with: four-bar hypermeter. */
export const DEFAULT_GROUP = 4

/**
 * Each bar of the grid as [start, end], in time order. A bar ends at the next
 * downbeat or where its segment stops; a last bar cut to under a tenth of a bar
 * is left out, as the grid does when it counts bars. Free stretches have none.
 */
export function gridBars(segs: GridSegment[], duration: number): Array<[number, number]> {
  return numberedGridBars(segs, duration).map((b) => [b.start, b.end])
}

/** gridBars with each bar's number on the grid's ruler (which honors a segment's firstBar). */
export function numberedGridBars(segs: GridSegment[], duration: number): Array<{ start: number; end: number; bar: number }> {
  if (!segs.length || !(duration > 0)) return []
  const downbeats = gridLines(segs, duration, 0, duration, Infinity).filter((l) => l.bar !== null)
  const out: Array<{ start: number; end: number; bar: number }> = []
  downbeats.forEach((d, k) => {
    const hit = segmentAt(segs, d.time, duration)
    if (!hit) return
    const len = barLength(hit.seg)
    const end = Math.min(d.time + len, segmentEnd(segs, hit.i, duration), downbeats[k + 1]?.time ?? Infinity)
    if (end - d.time >= len / 10) out.push({ start: d.time, end, bar: d.bar! })
  })
  return out
}

/** Counts for `n` hyperbeats in groups of `group`, starting at `from`: 1, 2, 3, 4, 1 … */
export function countRun(n: number, group: number, from = 1): Hypermeter[] {
  const size = Math.max(1, Math.round(group))
  return Array.from({ length: Math.max(0, n) }, (_, k) => ({ count: ((from - 1 + k) % size) + 1 }))
}

/**
 * The place a hyperbeat starts its group at, or null for none. An elided one
 * counts as what it becomes: 4=1 is 1.
 */
export function placeOf(h: Hypermeter | null | undefined): number | null {
  return h ? (h.becomes ?? h.count) : null
}

/** How a hypermeter is written: "4", or "4=1" for an elided hyperbeat. */
export function hypermeterText(h: Hypermeter | null | undefined): string {
  return h ? (h.becomes != null ? `${h.count}=${h.becomes}` : String(h.count)) : ''
}

/**
 * A hypermeter typed or found as text: "4", or "4=1" (spaces allowed); null
 * for text that isn't one, or a count below 1.
 */
export function parseHypermeter(text: string | null | undefined): Hypermeter | null {
  const m = /^\s*(\d+)\s*(?:=\s*(\d+)\s*)?$/.exec(text ?? '')
  if (!m) return null
  const count = Number(m[1])
  const becomes = m[2] === undefined ? undefined : Number(m[2])
  if (count < 1 || (becomes !== undefined && becomes < 1)) return null
  return becomes === undefined ? { count } : { count, becomes }
}

/** Whether a span's hypermeter is drawn: its own choice, else its layer's (on by default). */
export function hypermeterShown(span: Pick<Span, 'showHypermeter'>, layer: Pick<Layer, 'showHypermeter'>): boolean {
  return span.showHypermeter ?? layer.showHypermeter ?? true
}

/**
 * The hypermeter of a run of hyperbeats after eliding the one at `at`: it
 * takes the count it would have had after the one before it, becoming 1, and
 * those after it count on from 2 until one with no hypermeter. Those before
 * `at` are unchanged.
 */
export function elideCounts(hs: Array<Hypermeter | null | undefined>, at: number, group: number): Array<Hypermeter | null | undefined> {
  const size = Math.max(1, Math.round(group))
  const prev = at > 0 ? placeOf(hs[at - 1]) : null
  const wouldBe = prev === null ? size : (prev % size) + 1
  const out = [...hs]
  out[at] = { count: wouldBe, becomes: 1 }
  for (let k = at + 1, count = 2; k < out.length && out[k] != null; k++, count++) {
    out[k] = { count: ((count - 1) % size) + 1 }
  }
  return out
}

// ---------------------------------------------------------------------------
// The bar layer (Layer.role 'bars'): a layer that marks every bar. Its labels
// are bar numbers and its spans' hypermeter their counts, so the count sits
// inside each bar's shape and the label says which bar it is.
// docs/decisions.md, "The Bar Layer".
// ---------------------------------------------------------------------------

/** Bar numbers for `n` bars from `first`: "1", "2", "3" … */
export function barNumberLabels(n: number, first = 1): string[] {
  const start = Math.round(first)
  return Array.from({ length: Math.max(0, n) }, (_, k) => String(start + k))
}

/**
 * Counts for bars grouped by the spans of another layer (phrases, say): the
 * count starts at 1 in each group and runs on to the group's end, so a
 * six-bar phrase counts to 6 and an expanded one to 7 or 8 with no group size
 * set. A bar belongs to the group its middle falls in. Bars in no group count
 * in groups of `group`, from 1 after the last group ends.
 */
export function countsByGroups(
  bars: Array<[number, number]>,
  groups: Array<[number, number]>,
  group: number,
): Hypermeter[] {
  const size = Math.max(1, Math.round(group))
  const sorted = [...groups].sort((a, b) => a[0] - b[0])
  let current = -2 // the group of the bar before: -1 is "none", -2 "no bar yet"
  let count = 0
  return bars.map(([s, e]) => {
    const mid = (s + e) / 2
    const g = sorted.findIndex(([gs, ge]) => mid >= gs && mid < ge)
    if (g !== current) count = 0
    current = g
    count = g < 0 ? (count % size) + 1 : count + 1
    return { count }
  })
}

/**
 * Where a boundary of `spans` (another layer's, sorted by time) falls on a
 * bar: at its start, else at its end, within a twentieth of the bar. Returns
 * the two spans that meet there, or null. Eliding a bar offers to mark that
 * boundary elided: the phrase ends and the next begins in the same bar.
 */
export function boundaryOnBar<S extends { startTime: number; endTime: number }>(
  bar: [number, number],
  spans: S[],
): { before: S; after: S } | null {
  const tol = Math.min(0.05, (bar[1] - bar[0]) / 20)
  for (const t of bar) {
    for (let k = 1; k < spans.length; k++) {
      const before = spans[k - 1]
      const after = spans[k]
      if (Math.abs(after.startTime - t) <= tol && Math.abs(before.endTime - after.startTime) <= tol) return { before, after }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Quick setup between phrases and bars, for any run of selected spans: a chunk
// of the recording or all of it. docs/decisions.md, "Bars From Phrases, Phrases
// From Bars".
// ---------------------------------------------------------------------------

/** [start, end] split into `n` equal bars. */
export function splitEvenly(start: number, end: number, n: number): Array<[number, number]> {
  const count = Math.max(1, Math.round(n))
  const len = (end - start) / count
  return Array.from({ length: count }, (_, k) => [start + k * len, k === count - 1 ? end : start + (k + 1) * len])
}

/**
 * The phrases a run of counted bars (sorted by time) makes: one starts at the
 * first bar and at every bar counted 1 ("1", or "4=1" for an elided bar), and
 * runs to the bar before the next. `elided` marks a phrase whose first bar is
 * elided, so the phrase before it ends in that bar. Bars with no hypermeter
 * stay in the phrase they fall in.
 */
export function phraseRuns<B extends { id: string; startTime: number; endTime: number; hypermeter?: Hypermeter | null }>(
  bars: B[],
): Array<{ start: number; end: number; ids: string[]; elided: boolean }> {
  const runs: Array<{ start: number; end: number; ids: string[]; elided: boolean }> = []
  for (const b of bars) {
    const last = runs[runs.length - 1]
    if (!last || placeOf(b.hypermeter) === 1) {
      runs.push({ start: b.startTime, end: b.endTime, ids: [b.id], elided: !!last && b.hypermeter?.becomes != null })
    } else {
      last.end = b.endTime
      last.ids.push(b.id)
    }
  }
  return runs
}
