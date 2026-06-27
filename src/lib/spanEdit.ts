/**
 * Pure span-editing logic — no React, no store. Unit-tested in isolation.
 *
 * These functions take the current spans array and return a new one (or null
 * for a no-op). The document store wraps them; the spacebar handler and the
 * metadata panel's Split action both call through the store.
 */

import type { Span } from '@/types/strata'

/** Absolute minimum span width in seconds — the data floor against collapse. */
export const MIN_SPAN_WIDTH = 0.25

/**
 * Minimum on-screen width (px) a span may be squeezed to by a boundary drag.
 * Converted to seconds at the current zoom, this becomes a zoom-aware floor: at
 * low zoom you cannot shrink a neighbor below what you can resolve, so a drag can
 * never make a span invisibly small. Zoom in to make genuinely narrow spans.
 */
export const MIN_BOUNDARY_DRAG_PX = 8

/**
 * Place a boundary at `time` on a layer's spans (the spacebar / Split gesture,
 * Phase 0.4 §8). Returns the new spans array, or null if nothing should happen.
 *
 * - Empty layer: create two spans, [0, time] and [time, duration].
 * - Otherwise: split the span that strictly contains `time` into [start, time]
 *   and [time, end]. The new cut is a 'definite' boundary on both inner faces;
 *   the outer faces keep the original boundary character. Both halves inherit
 *   the original's attributes (type, label, colors, line style, confidence).
 *
 * No-ops (return null): `time` not inside any span, or the cut would leave
 * either side narrower than MIN_SPAN_WIDTH.
 */
export function placeBoundaryInSpans(
  spans: Span[],
  time: number,
  duration: number,
  mkId: () => string,
): Span[] | null {
  if (spans.length === 0) {
    if (time < MIN_SPAN_WIDTH || time > duration - MIN_SPAN_WIDTH) return null
    return [
      { id: mkId(), startTime: 0, endTime: time },
      { id: mkId(), startTime: time, endTime: duration },
    ]
  }

  const i = spans.findIndex((s) => time > s.startTime && time < s.endTime)
  if (i === -1) return null

  const orig = spans[i]
  if (time - orig.startTime < MIN_SPAN_WIDTH || orig.endTime - time < MIN_SPAN_WIDTH) {
    return null
  }

  const left: Span = { ...orig, endTime: time, endBoundaryType: 'definite' }
  const right: Span = {
    ...orig,
    id: mkId(),
    startTime: time,
    startBoundaryType: 'definite',
  }
  return [...spans.slice(0, i), left, right, ...spans.slice(i + 1)]
}
