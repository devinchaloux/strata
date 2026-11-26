/**
 * Re-tapping (docs/decisions.md, "Re-Tapping Boundaries"): pressing R on a beat
 * while the track plays moves the nearest boundary on the active layer to the
 * average of its re-taps. Hand marks scatter by 20–30 ms; playing a passage
 * again and tapping along corrects them by ear, and each pass narrows the
 * scatter (the average of n taps scatters about 1/√n as much). The original
 * mark isn't counted once a boundary is re-tapped: it's the one being fixed.
 *
 * Pure: which boundary a tap is for, and where the taps put it. The taps
 * themselves are kept for the session (uiStore.retaps).
 */
import type { Span } from '@/types/strata'

/** A tap counts for a boundary within this share of the shorter span beside it, so it can't reach the next one. */
export const RETAP_REACH = 0.4

export interface RetapTarget {
  /** The spans either side of the boundary. */
  leftId: string
  rightId: string
  /** Where the boundary is now. */
  time: number
}

/**
 * The boundary a tap at `t` is for: the nearest one between two touching spans,
 * if the tap is within RETAP_REACH of the shorter of them; else null.
 */
export function retapTarget(spans: Span[], t: number): RetapTarget | null {
  const sorted = [...spans].sort((a, b) => a.startTime - b.startTime)
  let best: RetapTarget | null = null
  let bestGap = Infinity
  for (let k = 1; k < sorted.length; k++) {
    const left = sorted[k - 1]
    const right = sorted[k]
    if (Math.abs(left.endTime - right.startTime) > 1e-6) continue
    const at = right.startTime
    const gap = Math.abs(t - at)
    const reach = RETAP_REACH * Math.min(left.endTime - left.startTime, right.endTime - right.startTime)
    if (gap <= reach && gap < bestGap) {
      bestGap = gap
      best = { leftId: left.id, rightId: right.id, time: at }
    }
  }
  return best
}

/** The key a boundary's taps are kept under: its layer and the span it starts. */
export const retapKey = (layerId: string, rightId: string) => `${layerId}|${rightId}`

/** Where a boundary goes for its taps: their average. */
export function retapTime(taps: number[]): number {
  return taps.reduce((s, v) => s + v, 0) / taps.length
}
