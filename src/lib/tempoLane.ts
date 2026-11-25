/**
 * Tempo from marked bars: each bar's tempo read from its length, as beats in
 * the bar over its seconds, and the scale and layout to draw it as a step line
 * (TempoLaneFigure in widgets/form-diagram/figure.tsx). Groundwork for the
 * tempo widget (widgets/tempo.md); nothing here is stored.
 * docs/decisions.md, "Tempo Becomes Its Own Widget".
 */
import type { Layer, StrataDocument } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { segmentAt, sortedSegments } from '@/lib/beatGrid'

/** Height of the lane, in px, from the top of its band to the ruler. */
export const TEMPO_LANE_HEIGHT = 52
/** Room above the highest tempo and below the lowest, in px. */
export const TEMPO_PAD_TOP = 12
export const TEMPO_PAD_BOTTOM = 6

export interface TempoStep {
  start: number
  end: number
  bpm: number
  /** The bar's label (its number on the bar layer), for a hover title. */
  bar: string | null
}

export interface TempoScale {
  min: number
  max: number
  /** Tempos to draw guide lines at, low to high. */
  ticks: number[]
}

export interface TempoLane {
  layer: Layer
  steps: TempoStep[]
  scale: TempoScale
}

/**
 * Beats in the bar at time t: the beat grid's meter there, else the document's
 * meter, else 4.
 */
export function beatsPerBarAt(doc: StrataDocument): (t: number) => number {
  const segs = sortedSegments(doc.beatGrid)
  const fallback = doc.timeSignature?.numerator || 4
  return (t) => segmentAt(segs, t + 1e-6, doc.duration)?.seg.beatsPerBar || fallback
}

/** Each bar's tempo, from its length; bars shorter than a millisecond are left out. */
export function tempoSteps(layer: Layer, beatsAt: (t: number) => number): TempoStep[] {
  return [...formSpans(layer)]
    .sort((a, b) => a.startTime - b.startTime)
    .filter((s) => s.endTime - s.startTime > 0.001)
    .map((s) => ({
      start: s.startTime,
      end: s.endTime,
      bpm: (60 * beatsAt(s.startTime)) / (s.endTime - s.startTime),
      bar: s.label ?? null,
    }))
}

/**
 * The scale for a run of tempos: from the lowest to the highest, out to the
 * nearest 10, with guide lines at both ends and, where there is room, at a
 * round tempo between them.
 */
export function tempoScale(steps: TempoStep[]): TempoScale {
  const bpms = steps.map((s) => s.bpm)
  let min = Math.floor(Math.min(...bpms) / 10) * 10
  let max = Math.ceil(Math.max(...bpms) / 10) * 10
  if (max - min < 10) {
    min -= 5
    max += 5
  }
  min = Math.max(0, min)
  const mid = Math.round((min + max) / 2 / 10) * 10
  const ticks = max - min >= 40 && mid > min && mid < max ? [min, mid, max] : [min, max]
  return { min, max, ticks }
}

/** y of a tempo within a lane whose band starts at `top`. */
export function tempoY(bpm: number, scale: TempoScale, top: number): number {
  const inner = TEMPO_LANE_HEIGHT - TEMPO_PAD_TOP - TEMPO_PAD_BOTTOM
  const f = scale.max > scale.min ? (bpm - scale.min) / (scale.max - scale.min) : 0.5
  return top + TEMPO_PAD_TOP + (1 - Math.max(0, Math.min(1, f))) * inner
}

/**
 * The tempo of a layer of bars, or null when it has fewer than two. With
 * `range`, only the bars in it, cut at its edges and moved so the range starts
 * at 0 (for export); a bar's tempo is always read from the whole bar.
 */
export function tempoLane(
  doc: StrataDocument,
  layer: Layer,
  range?: { start: number; end: number },
): TempoLane | null {
  if (layer.type !== 'form-diagram') return null
  let steps = tempoSteps(layer, beatsPerBarAt(doc))
  if (steps.length < 2) return null
  const scale = tempoScale(steps)
  if (range) {
    steps = steps
      .filter((s) => s.end > range.start && s.start < range.end)
      .map((s) => ({ ...s, start: Math.max(s.start, range.start) - range.start, end: Math.min(s.end, range.end) - range.start }))
    if (!steps.length) return null
  }
  return { layer, steps, scale }
}
