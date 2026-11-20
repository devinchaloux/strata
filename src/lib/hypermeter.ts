/**
 * Hypermeter: one span per bar, counted 1, 2, 3, 4, 1 … in groups.
 *
 * The analyst numbers bars to show hypermeter: Number bars fills an empty
 * layer with one span per bar of the beat grid; Number from 1 recounts a run
 * of selected bars, so a phrase of 3 or 6 in the middle of fours is one
 * press; Elide turns one bar into "4=1", the bar that ends one group and
 * begins the next, and counts on from 2 after it. The counts are ordinary
 * span labels, so the analyst can edit any of them by hand.
 * docs/decisions.md, "Numbering Hypermeter".
 *
 * Pure functions; the store (documentStore numberBars, renumberSpans,
 * elideSpan) applies them.
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
  if (!segs.length || !(duration > 0)) return []
  const downbeats = gridLines(segs, duration, 0, duration, Infinity).filter((l) => l.bar !== null)
  const out: Array<[number, number]> = []
  downbeats.forEach((d, k) => {
    const hit = segmentAt(segs, d.time, duration)
    if (!hit) return
    const len = barLength(hit.seg)
    const end = Math.min(d.time + len, segmentEnd(segs, hit.i, duration), downbeats[k + 1]?.time ?? Infinity)
    if (end - d.time >= len / 10) out.push([d.time, end])
  })
  return out
}

/** Counts for `n` bars in groups of `group`, starting at `from`: "1", "2", "3", "4", "1" … */
export function countLabels(n: number, group: number, from = 1): string[] {
  const size = Math.max(1, Math.round(group))
  return Array.from({ length: Math.max(0, n) }, (_, k) => String(((from - 1 + k) % size) + 1))
}

/**
 * The count a bar's label carries, or null for a label that isn't one. An
 * elided bar counts as what it becomes: "4=1" is 1.
 */
export function countOf(label: string | null | undefined): number | null {
  const m = /^\s*(?:\d+\s*=\s*)?(\d+)\s*$/.exec(label ?? '')
  return m ? Number(m[1]) : null
}

/**
 * The labels of a run of bars after eliding bar `at`: it takes the count it
 * would have had after the bar before it, "=1", and the bars after it count on
 * from 2 until a bar whose label isn't a count (an unlabelled bar, or a word),
 * where the analyst's own labels resume. Bars before `at` are unchanged.
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
