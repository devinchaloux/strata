/**
 * Hypermeter: bars counted 1, 2, 3, 4, 1 … in groups.
 *
 * The analyst counts bars to show hypermeter. Fill with bars makes an empty
 * layer the bar layer, one span per bar of the beat grid; Count these bars
 * recounts a run of selected bars from 1, so a phrase of 3 or 6 in the middle
 * of fours is one press; Elide turns one bar into "4=1", the bar that ends one
 * group and begins the next, and counts on from 2 after it. Counts are written
 * into span annotations, inside the shape (a span's label is its name, on the
 * bar layer its bar number), and never over an annotation that holds other
 * text. The analyst can edit any of them by hand.
 * docs/decisions.md, "Numbering Hypermeter" and "The Bar Layer".
 *
 * Pure functions; the store (documentStore numberBars, renumberSpans,
 * elideSpan, setBarLayer, numberBarLayer, countBars, elideGroupBoundary)
 * applies them.
 */
import type { GridSegment } from '@/types/strata'
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

/** Counts for `n` bars in groups of `group`, starting at `from`: "1", "2", "3", "4", "1" … */
export function countLabels(n: number, group: number, from = 1): string[] {
  const size = Math.max(1, Math.round(group))
  return Array.from({ length: Math.max(0, n) }, (_, k) => String(((from - 1 + k) % size) + 1))
}

/**
 * The count a bar's text carries, or null for text that isn't one. An
 * elided bar counts as what it becomes: "4=1" is 1.
 */
export function countOf(label: string | null | undefined): number | null {
  const m = /^\s*(?:\d+\s*=\s*)?(\d+)\s*$/.exec(label ?? '')
  return m ? Number(m[1]) : null
}

/**
 * The counts of a run of bars after eliding bar `at`: it takes the count it
 * would have had after the bar before it, "=1", and the bars after it count on
 * from 2 until a bar whose text isn't a count (an empty one, or a word), where
 * the analyst's own text resumes. Bars before `at` are unchanged.
 */
export function elideLabels(labels: Array<string | null | undefined>, at: number, group: number): Array<string | null | undefined> {
  const size = Math.max(1, Math.round(group))
  const prev = at > 0 ? countOf(labels[at - 1]) : null
  const wouldBe = prev === null ? size : (prev % size) + 1
  const out = [...labels]
  out[at] = `${wouldBe}=1`
  for (let k = at + 1, count = 2; k < out.length && countOf(out[k]) !== null; k++, count++) {
    out[k] = String(((count - 1) % size) + 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// The bar layer (Layer.role 'bars'): a layer that marks every bar. Its labels
// are bar numbers and its annotations the hypermetric counts, so the count
// sits inside each bar's shape and the label says which bar it is.
// docs/decisions.md, "The Bar Layer".
// ---------------------------------------------------------------------------

/** Bar numbers for `n` bars from `first`: "1", "2", "3" … */
export function barNumberLabels(n: number, first = 1): string[] {
  const start = Math.round(first)
  return Array.from({ length: Math.max(0, n) }, (_, k) => String(start + k))
}

/**
 * Whether a count may be written over this text: it is empty, or already a
 * count. Anything else is the analyst's own note and is left alone.
 */
export function holdsCount(text: string | null | undefined): boolean {
  return !text?.trim() || countOf(text) !== null
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
): string[] {
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
    return String(count)
  })
}

/**
 * The texts after writing `counts` over `existing`, one to one: a count goes
 * where the text holds a count or nothing (holdsCount); a note stays.
 */
export function writeCounts(
  existing: Array<string | null | undefined>,
  counts: Array<string | null | undefined>,
): Array<string | null | undefined> {
  return existing.map((t, k) => (holdsCount(t) ? counts[k] : t))
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
 * elided, so the phrase before it ends in that bar. Bars whose annotation isn't
 * a count stay in the phrase they fall in.
 */
export function phraseRuns<B extends { id: string; startTime: number; endTime: number; annotation?: string | null }>(
  bars: B[],
): Array<{ start: number; end: number; ids: string[]; elided: boolean }> {
  const runs: Array<{ start: number; end: number; ids: string[]; elided: boolean }> = []
  for (const b of bars) {
    const last = runs[runs.length - 1]
    if (!last || countOf(b.annotation) === 1) {
      runs.push({ start: b.startTime, end: b.endTime, ids: [b.id], elided: !!last && (b.annotation ?? '').includes('=') })
    } else {
      last.end = b.endTime
      last.ids.push(b.id)
    }
  }
  return runs
}
