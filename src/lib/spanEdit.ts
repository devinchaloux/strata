/**
 * Pure span-editing logic — no React, no store. Unit-tested in isolation.
 *
 * These functions take the current spans array and return a new one (or null
 * for a no-op). The document store wraps them; the boundary-key (B) handler and the
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
 * Place a boundary at `time` on a layer's spans (the B / Split gesture,
 * Phase 0.4 §8). Returns the new spans array, or null if nothing should happen.
 *
 * - Inside a span: split it into [start, time] and [time, end]. The new cut is
 *   a 'definite' boundary on both inner faces (no elision cap, default drawing
 *   order); the outer faces keep the original boundary character. Both halves inherit the original's attributes
 *   (type, label, colors, line style, confidence).
 * - Inside a gap: fill the gap with two bare spans, [gapStart, time] and
 *   [time, gapEnd]. An empty layer is simply one gap covering the whole track,
 *   so this is the same rule the first boundary press has always followed.
 *   Gaps are an analyst's choice (Devin, 2026-09-27), made by deleting spans;
 *   this is how one gets filled again.
 *
 * - With `fillGaps` false (Layer.fillGaps), a boundary in a gap starts one span
 *   there, [time, gapEnd], and leaves the stretch before it empty.
 *
 * No-ops (return null): `time` sits exactly on a boundary, or the cut would
 * leave either side narrower than MIN_SPAN_WIDTH.
 */
export function placeBoundaryInSpans(
  spans: Span[],
  time: number,
  duration: number,
  mkId: () => string,
  fillGaps = true,
): Span[] | null {
  const i = spans.findIndex((s) => time > s.startTime && time < s.endTime)
  if (i === -1) return fillGap(spans, time, duration, mkId, fillGaps)

  const orig = spans[i]
  if (time - orig.startTime < MIN_SPAN_WIDTH || orig.endTime - time < MIN_SPAN_WIDTH) {
    return null
  }

  // The new inner cut is a clean boundary on both faces, so anything that
  // belonged to the original's OUTER ends stays on the outer ends: an elision
  // cap and the end drawing order would otherwise be copied onto the new cut.
  const left: Span = {
    ...orig,
    endTime: time,
    endBoundaryType: 'definite',
    endCap: orig.endCap === 'elision' ? undefined : orig.endCap,
    endOnTop: undefined,
  }
  const right: Span = {
    ...orig,
    id: mkId(),
    startTime: time,
    startBoundaryType: 'definite',
    startCap: orig.startCap === 'elision' ? undefined : orig.startCap,
  }
  return [...spans.slice(0, i), left, right, ...spans.slice(i + 1)]
}

/** The empty stretch of the track around `time`, or null if `time` is not in one. */
export function gapAt(spans: Span[], time: number, duration: number): [number, number] | null {
  if (time <= 0 || time >= duration) return null
  if (spans.some((s) => time >= s.startTime && time <= s.endTime)) return null
  const start = Math.max(0, ...spans.filter((s) => s.endTime <= time).map((s) => s.endTime))
  const end = Math.min(duration, ...spans.filter((s) => s.startTime >= time).map((s) => s.startTime))
  return [start, end]
}

function fillGap(spans: Span[], time: number, duration: number, mkId: () => string, both: boolean): Span[] | null {
  const gap = gapAt(spans, time, duration)
  if (!gap) return null
  const [start, end] = gap
  // A layer that doesn't fill gaps (Layer.fillGaps false) starts a span here
  // and leaves the stretch before it empty.
  if (!both) {
    if (end - time < MIN_SPAN_WIDTH) return null
    return [...spans, { id: mkId(), startTime: time, endTime: end }].sort((a, b) => a.startTime - b.startTime)
  }
  if (time - start < MIN_SPAN_WIDTH || end - time < MIN_SPAN_WIDTH) return null
  return [
    ...spans,
    { id: mkId(), startTime: start, endTime: time },
    { id: mkId(), startTime: time, endTime: end },
  ].sort((a, b) => a.startTime - b.startTime)
}

// ---------------------------------------------------------------------------
// The tiling invariant
// ---------------------------------------------------------------------------
// Spans within one layer never overlap (Devin, 2026-09-27). Overlapping
// analytical claims live on separate layers. Every gesture already kept a layer
// tiled; these helpers let the store and the file loader enforce it.

/** Pairs of span ids whose time ranges overlap within one layer's spans. */
export function findOverlaps(spans: Span[]): [string, string][] {
  const sorted = [...spans].sort((a, b) => a.startTime - b.startTime)
  const pairs: [string, string][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].startTime < sorted[i].endTime; j++) {
      pairs.push([sorted[i].id, sorted[j].id])
    }
  }
  return pairs
}

/**
 * Move one edge of a span to `time` (numeric time entry). Returns the new
 * spans array, or null if the span doesn't exist.
 *
 * If a neighbour touches that edge, the shared boundary moves — the same thing
 * a boundary drag does — so both spans stay at least MIN_SPAN_WIDTH wide. If a
 * gap lies beyond the edge, the edge may move into the gap but not past it.
 * Either way the layer stays tiled.
 */
export function setSpanEdge(
  spans: Span[],
  spanId: string,
  edge: 'start' | 'end',
  time: number,
  duration: number,
): Span[] | null {
  const span = spans.find((s) => s.id === spanId)
  if (!span) return null

  if (edge === 'start') {
    const touching = spans.find((s) => s.id !== spanId && s.endTime === span.startTime)
    const floor = touching
      ? touching.startTime + MIN_SPAN_WIDTH
      : Math.max(0, ...spans.filter((s) => s.id !== spanId && s.endTime <= span.startTime).map((s) => s.endTime))
    const t = Math.max(floor, Math.min(time, span.endTime - MIN_SPAN_WIDTH))
    return spans.map((s) => {
      if (s.id === spanId) return { ...s, startTime: t }
      if (touching && s.id === touching.id) return { ...s, endTime: t }
      return s
    })
  }

  const touching = spans.find((s) => s.id !== spanId && s.startTime === span.endTime)
  const ceiling = touching
    ? touching.endTime - MIN_SPAN_WIDTH
    : Math.min(duration, ...spans.filter((s) => s.id !== spanId && s.startTime >= span.endTime).map((s) => s.startTime))
  const t = Math.min(ceiling, Math.max(time, span.startTime + MIN_SPAN_WIDTH))
  return spans.map((s) => {
    if (s.id === spanId) return { ...s, endTime: t }
    if (touching && s.id === touching.id) return { ...s, startTime: t }
    return s
  })
}

/**
 * End the span at `time` there, leaving the rest of it empty (Shift+B): the
 * counterpart of starting a span in a gap. Returns null outside a span, or
 * when either part would be narrower than MIN_SPAN_WIDTH.
 */
export function endSpanAtTime(spans: Span[], time: number): Span[] | null {
  const i = spans.findIndex((s) => time > s.startTime && time < s.endTime)
  if (i === -1) return null
  const s = spans[i]
  if (time - s.startTime < MIN_SPAN_WIDTH || s.endTime - time < MIN_SPAN_WIDTH) return null
  return spans.map((x, j) => (j === i ? { ...x, endTime: time, endCap: x.endCap === 'elision' ? undefined : x.endCap, endOnTop: undefined } : x))
}

/**
 * Move every boundary in a layer to the grid (`snap`, e.g. to the nearest bar).
 * A boundary two spans share moves once, for both. A boundary whose snapped
 * time would collide with or pass its neighbour stays put, as does one in a
 * free stretch (where `snap` returns the time unchanged). Returns the new
 * spans and how many boundaries moved.
 */
export function snapSpansToGrid(spans: Span[], snap: (t: number) => number): { spans: Span[]; moved: number } {
  const times = [...new Set(spans.flatMap((s) => [s.startTime, s.endTime]))].sort((a, b) => a - b)
  const to = new Map<number, number>()
  let prev = -Infinity
  let moved = 0
  for (let k = 0; k < times.length; k++) {
    const t = times[k]
    const next = k + 1 < times.length ? times[k + 1] : Infinity
    let s = snap(t)
    if (s - prev < MIN_SPAN_WIDTH || next - s < MIN_SPAN_WIDTH || Math.abs(s - t) < 1e-6) s = t
    else moved++
    to.set(t, s)
    prev = s
  }
  return {
    spans: spans.map((x) => ({ ...x, startTime: to.get(x.startTime) ?? x.startTime, endTime: to.get(x.endTime) ?? x.endTime })),
    moved,
  }
}
