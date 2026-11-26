/**
 * Tempo from marked bars: each bar's tempo read from its length, as beats in
 * the bar over its seconds, and the scale and layout to draw it as a step line
 * (TempoLaneFigure in widgets/segmentation/figure.tsx), and what the tempo
 * widget draws (tempoView: marked, smoothed, deviation). Nothing here is
 * stored. widgets/tempo.md; docs/decisions.md, "Widgets as Blocks".
 */
import type { Layer, StrataDocument, TempoLayer } from '@/types/strata'
import { autoLogLambda, smoothAnchored, smoothTimes } from '@/lib/normalize'
import { segmentSpans } from '@/lib/layers'
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
  /** The bar's span id, to select it from the tempo. */
  id?: string
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
  return [...segmentSpans(layer)]
    .sort((a, b) => a.startTime - b.startTime)
    .filter((s) => s.endTime - s.startTime > 0.001)
    .map((s) => ({
      start: s.startTime,
      end: s.endTime,
      bpm: (60 * beatsAt(s.startTime)) / (s.endTime - s.startTime),
      bar: s.label ?? null,
      id: s.id,
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
  if (layer.type !== 'segmentation') return null
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

// ---------------------------------------------------------------------------
// The tempo widget's views (widgets/tempo.md): marked, smoothed, deviation.
// ---------------------------------------------------------------------------

export interface TempoDeviation {
  /** The boundary as marked, in seconds. */
  time: number
  /** Marked minus smoothed, in milliseconds: positive = marked late. */
  ms: number
}

export interface TempoView {
  /** The layer read, or null when it's gone or isn't a form layer. */
  source: Layer | null
  marked: TempoStep[]
  /** The same bars with boundaries through the display smoother; empty unless asked for. */
  smoothed: TempoStep[]
  deviations: TempoDeviation[]
  /**
   * The tapping scatter, in ms: the deviations' spread, read from their median
   * size (1.4826 × the median absolute deviation, which equals the standard
   * deviation for normal scatter) so that one odd bar, such as a long last bar
   * holding a fade, can't swamp it. 0 without deviations.
   */
  scatterMs: number
  scale: TempoScale
}

/**
 * Runs of spans that follow one another (each starting where the one before
 * ends), as boundary times; smoothing never reaches across a gap.
 */
export function boundaryRuns(steps: TempoStep[]): number[][] {
  const runs: number[][] = []
  for (const s of steps) {
    const last = runs[runs.length - 1]
    if (last && Math.abs(last[last.length - 1] - s.start) < 1e-6) last.push(s.end)
    else runs.push([s.start, s.end])
  }
  return runs
}

/**
 * Everything a tempo layer draws. The smoother is Normalize's (lib/normalize.ts)
 * at 10^smoothing, or at its automatic setting when smoothing is absent; it
 * only shapes the drawing and moves no boundary.
 */
export function tempoView(doc: StrataDocument, layer: TempoLayer): TempoView {
  const display = layer.data?.display ?? {}
  const show = display.show?.length ? display.show : ['marked']
  const source = doc.layers.find((l) => l.id === layer.data?.source?.layerId && l.type === 'segmentation') ?? null
  const beatsAt = beatsPerBarAt(doc)
  const marked = source ? tempoSteps(source, beatsAt) : []
  const wantSmooth = show.includes('smoothed') || show.includes('deviation')
  const smoothed: TempoStep[] = []
  const deviations: TempoDeviation[] = []
  if (wantSmooth && marked.length) {
    let k = 0
    for (const run of boundaryRuns(marked)) {
      const g = display.smoothing ?? autoLogLambda(run)
      const fit = smoothAnchored(run, 10 ** g)
      for (let j = 0; j < run.length - 1; j++, k++) {
        const len = fit[j + 1] - fit[j]
        smoothed.push({ ...marked[k], start: fit[j], end: fit[j + 1], bpm: len > 0 ? (60 * beatsAt(run[j])) / len : marked[k].bpm })
      }
      for (let j = 1; j < run.length - 1; j++) deviations.push({ time: run[j], ms: (run[j] - fit[j]) * 1000 })
    }
  }
  const scatterMs = robustSpread(deviations.map((d) => d.ms))
  const fixed = display.scale
  const scale = fixed && fixed.max > fixed.min
    ? { min: fixed.min, max: fixed.max, ticks: tempoScale([{ start: 0, end: 1, bpm: fixed.min, bar: null }, { start: 1, end: 2, bpm: fixed.max, bar: null }]).ticks.filter((t) => t >= fixed.min && t <= fixed.max) }
    : marked.length
      ? tempoScale(show.includes('marked') || !smoothed.length ? marked : smoothed)
      : { min: 0, max: 0, ticks: [] }
  return {
    source,
    marked: show.includes('marked') ? marked : [],
    smoothed: show.includes('smoothed') ? smoothed : [],
    deviations: show.includes('deviation') ? deviations : [],
    scatterMs,
    scale,
  }
}

/** 1.4826 × the median absolute value: a spread that one outlier can't move much. */
export function robustSpread(values: number[]): number {
  if (!values.length) return 0
  const abs = values.map(Math.abs).sort((a, b) => a - b)
  const m = abs.length >> 1
  const median = abs.length % 2 ? abs[m] : (abs[m - 1] + abs[m]) / 2
  return 1.4826 * median
}

/**
 * The deviation band's half-range in ms, out to the next 10: wide enough for
 * twice the scatter and for the deviations, but no wider than four times the
 * scatter (at least 20 ms), so an outlier is drawn clipped at the edge rather
 * than squashing the rest.
 */
export function deviationRange(view: TempoView): number {
  const most = Math.max(0, ...view.deviations.map((d) => Math.abs(d.ms)))
  const cap = Math.max(view.scatterMs * 4, 20)
  return Math.ceil(Math.max(view.scatterMs * 2, Math.min(most, cap), 10) / 10) * 10
}

// ---------------------------------------------------------------------------
// Whether a layer's tempo moves (docs/decisions.md, "Where Controls Live"):
// when a layer becomes the bar layer, Tempo is offered only if it does.
// ---------------------------------------------------------------------------

/** A smoothed tempo range wider than this, in BPM, counts as a tempo that moves. */
export const TEMPO_MOVES_BPM = 4

export interface TempoSummary {
  /** The smoothed tempo's low and high (5th and 95th percentile with 20 bars or more), and median, in BPM. */
  low: number
  high: number
  median: number
  moves: boolean
}

/**
 * How a layer of bars' tempo behaves, read through Normalize's smoother at its
 * automatic setting so tapping scatter doesn't count. Odd bars far from their
 * neighbours are set aside first, and the range leaves out the outer 5% at each
 * end when there are 20 bars or more, so one odd bar (a long last bar holding a
 * fade) can't make a steady track look as if it moves. Null with fewer than
 * two bars.
 */
export function tempoSummary(doc: StrataDocument, layer: Layer): TempoSummary | null {
  const beatsAt = beatsPerBarAt(doc)
  const all = tempoSteps(layer, beatsAt)
  if (all.length < 2) return null
  // A bar more than 25% off the running median of its neighbours (a fade held
  // in a long last bar, a pickup) is set aside before smoothing, which would
  // otherwise spread its jump over the bars beside it. An accelerando changes
  // by a few percent a bar, well inside that.
  const median = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b)
    return o[o.length >> 1]
  }
  const steps = all.filter((s, k) => {
    const near = all.slice(Math.max(0, k - 3), k + 4).map((x) => x.bpm)
    return Math.abs(s.bpm / median(near) - 1) <= 0.25
  })
  if (steps.length < 2) return null
  const bpms: number[] = []
  for (const run of boundaryRuns(steps)) {
    const fit = run.length >= 4 ? smoothTimes(run, 10 ** autoLogLambda(run)) : run
    for (let j = 0; j < run.length - 1; j++) {
      const len = fit[j + 1] - fit[j]
      if (len > 0) bpms.push((60 * beatsAt(run[j])) / len)
    }
  }
  const sorted = [...bpms].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
  const trim = sorted.length >= 20
  const low = trim ? at(0.05) : sorted[0]
  const high = trim ? at(0.95) : sorted[sorted.length - 1]
  return { low, high, median: at(0.5), moves: high - low > TEMPO_MOVES_BPM }
}
