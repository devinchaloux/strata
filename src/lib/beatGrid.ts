/**
 * The beat grid: bars and beats laid down by ear, in segments.
 *
 * A segment starts on a downbeat and runs at one tempo and meter until its
 * explicit end or the next segment, whichever comes first. Between segments
 * there is no grid: a freeform breakdown, a rubato passage, a fermata. The
 * analyst picks the grid back up by starting a new segment on the next
 * downbeat. Bar numbers continue across a gap unless a segment overrides its
 * first bar (Devin, 2026-09-29). docs/decisions.md, "Beat Grid".
 *
 * Beats are computed from the segments, never stored. Pure functions; the
 * store edits segments and the editor draws and snaps with these.
 */
import type { GridSegment } from '@/types/strata'

export type SnapMode = 'off' | 'beat' | 'bar'

/** Seconds per beat and per bar. */
export const beatLength = (s: GridSegment) => 60 / s.bpm
export const barLength = (s: GridSegment) => (s.beatsPerBar * 60) / s.bpm

/** Segments in time order. */
export function sortedSegments(grid: GridSegment[] | undefined | null): GridSegment[] {
  return [...(grid ?? [])].sort((a, b) => a.start - b.start)
}

/** Where segment `i` stops: its own end, the next segment's start, or the track's end. */
export function segmentEnd(segs: GridSegment[], i: number, duration: number): number {
  const next = segs[i + 1]?.start ?? duration
  const own = segs[i].end ?? Infinity
  return Math.max(segs[i].start, Math.min(own, next, duration > 0 ? duration : Infinity))
}

/**
 * Bars a segment spans. A last bar cut short still counts, unless it is under
 * a tenth of a bar: pressing G a moment after a downbeat shouldn't add a bar.
 */
function barsIn(segs: GridSegment[], i: number, duration: number): number {
  const span = segmentEnd(segs, i, duration) - segs[i].start
  return Math.max(0, Math.ceil(span / barLength(segs[i]) - 0.1))
}

/** The number of each segment's first bar: its override, else continuing from the one before. */
export function firstBarNumbers(segs: GridSegment[], duration: number): number[] {
  const out: number[] = []
  segs.forEach((s, i) => {
    out.push(s.firstBar ?? (i === 0 ? 1 : out[i - 1] + barsIn(segs, i - 1, duration)))
  })
  return out
}

/** The segment covering time `t`, with its index, or null in a free stretch. */
export function segmentAt(segs: GridSegment[], t: number, duration: number): { seg: GridSegment; i: number } | null {
  for (let i = 0; i < segs.length; i++) {
    if (t >= segs[i].start - 1e-6 && t < segmentEnd(segs, i, duration) + 1e-6) return { seg: segs[i], i }
  }
  return null
}

export interface GridLine {
  time: number
  /** The bar number on a downbeat; null on other beats. */
  bar: number | null
}

/**
 * Every beat between t0 and t1 (with its bar number on downbeats). Past
 * `maxLines` it returns downbeats only, so a zoomed-out long track stays cheap.
 */
export function gridLines(
  segs: GridSegment[],
  duration: number,
  t0: number,
  t1: number,
  maxLines = 4000,
): GridLine[] {
  const firsts = firstBarNumbers(segs, duration)
  const collect = (beatsToo: boolean) => {
    const out: GridLine[] = []
    segs.forEach((s, i) => {
      const end = segmentEnd(segs, i, duration)
      const from = Math.max(t0, s.start)
      const to = Math.min(t1, end)
      if (to < from) return
      const beat = beatLength(s)
      const k0 = Math.ceil((from - s.start) / beat - 1e-9)
      const k1 = Math.floor((to - s.start) / beat + 1e-9)
      for (let k = k0; k <= k1; k++) {
        const downbeat = k % s.beatsPerBar === 0
        if (!downbeat && !beatsToo) continue
        const time = s.start + k * beat
        // A line at the segment's end would open a bar that never happens (a
        // free stretch or the next segment follows), so the grid stops short.
        if (time >= end - 1e-9) break
        out.push({ time, bar: downbeat ? firsts[i] + k / s.beatsPerBar : null })
      }
    })
    return out
  }
  const all = collect(true)
  return all.length > maxLines ? collect(false) : all
}

/**
 * Snap a time to the nearest beat or bar of the segment it falls in. Outside
 * every segment (a free stretch) the time is returned unchanged. Snapping is
 * the analyst's choice (off by default), so when on it always pulls to the
 * nearest line, as in a DAW, rather than only within a few pixels.
 */
export function snapToGrid(t: number, segs: GridSegment[], duration: number, mode: SnapMode): number {
  if (mode === 'off') return t
  const hit = segmentAt(segs, t, duration)
  if (!hit) return t
  const unit = mode === 'bar' ? barLength(hit.seg) : beatLength(hit.seg)
  const snapped = hit.seg.start + Math.round((t - hit.seg.start) / unit) * unit
  const end = segmentEnd(segs, hit.i, duration)
  return snapped > end + 1e-6 ? end : snapped
}

/**
 * A grid from a run of taps, the first on a downbeat: the tempo, and where the
 * first tap "should" have landed, from a least-squares line through every tap
 * in the run (beat k at start + k × beat). Fitting the start as well as the
 * tempo keeps one early or late first tap from shifting the whole grid. Needs
 * four taps.
 */
export function fitTaps(taps: number[]): { start: number; bpm: number } | null {
  const n = taps.length
  if (n < 4) return null
  const meanI = (n - 1) / 2
  const meanT = taps.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  taps.forEach((t, i) => {
    num += (i - meanI) * (t - meanT)
    den += (i - meanI) ** 2
  })
  const beat = num / den
  if (!(beat > 0)) return null
  return { start: Math.max(0, meanT - beat * meanI), bpm: Math.round((60 / beat) * 10) / 10 }
}
