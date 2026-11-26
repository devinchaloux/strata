/**
 * The beat grid from marked bars: each bar becomes a stretch of the grid at
 * its own tempo, read from its length, so snapping, the ruler's bar numbers
 * and the metronome follow the bars as marked, through an accelerando or a
 * ritardando. Bars one after another at the same tempo (within 0.01 BPM, as
 * after Normalize's Steady) merge into one stretch. docs/decisions.md, "The
 * Beat Grid From the Bars".
 *
 * Pure functions; the store's gridFromBars applies them.
 */
import type { GridSegment, Span } from '@/types/strata'
import { barLength, segmentEnd, sortedSegments } from '@/lib/beatGrid'

/** Bars whose tempos differ by no more than this (BPM) share a stretch. */
export const SAME_TEMPO_BPM = 0.01

/** A bar's label as a bar number, or null when it isn't a whole number. */
function barNumber(label: string | null | undefined): number | null {
  return /^\s*-?\d+\s*$/.test(label ?? '') ? Number(label) : null
}

/**
 * Grid stretches for bars sorted by time. Each run of bars that follow one
 * another starts a stretch with the run's first bar number (from its label,
 * when that is a number) and ends where the run ends, so a gap between runs is
 * left free. `beatsAt` gives the beats in a bar at a time.
 */
export function gridFromBars(
  bars: Array<Pick<Span, 'startTime' | 'endTime' | 'label'>>,
  beatsAt: (t: number) => number,
  mkId: () => string,
  beatUnit?: number,
): GridSegment[] {
  const out: GridSegment[] = []
  let open: { seg: GridSegment; bars: number; firstBpm: number } | null = null
  const close = () => {
    if (!open) return
    const { seg, bars: k } = open
    const len = (seg.end as number) - seg.start
    // Exact, not rounded: a rounded tempo makes the last bar a hair short, and
    // the grid would draw a stray downbeat just before the next stretch.
    seg.bpm = (60 * seg.beatsPerBar * k) / len
    out.push(seg)
    open = null
  }
  bars.forEach((b, i) => {
    const len = b.endTime - b.startTime
    if (!(len > 0)) return
    const beats = beatsAt(b.startTime)
    const bpm = (60 * beats) / len
    const follows = i > 0 && Math.abs(bars[i - 1].endTime - b.startTime) < 1e-6
    if (open && follows && open.seg.beatsPerBar === beats && Math.abs(bpm - open.firstBpm) <= SAME_TEMPO_BPM) {
      open.seg.end = b.endTime
      open.bars += 1
      return
    }
    close()
    const seg: GridSegment = { id: mkId(), start: b.startTime, end: b.endTime, bpm, beatsPerBar: beats }
    if (beatUnit && beatUnit !== 4) seg.beatUnit = beatUnit
    const n = barNumber(b.label)
    if (!follows && n !== null) seg.firstBar = n
    open = { seg, bars: 1, firstBpm: bpm }
  })
  close()
  // A stretch's end matters only where a gap follows it: elsewhere the next
  // stretch starts there anyway, so the end is left off.
  return out.map((s, k) => {
    const next = out[k + 1]
    if (next && Math.abs(next.start - (s.end as number)) < 1e-6) {
      const rest = { ...s }
      delete rest.end
      return rest
    }
    return s
  })
}

/**
 * An existing grid with `made` put in over [from, to]. Stretches starting
 * inside are replaced. One running into it from before stops at `from`. One
 * running on past `to` carries on from its first downbeat at or after `to`,
 * so its bar lines stay where they were; the time between is left free.
 */
export function spliceGrid(
  existing: GridSegment[] | undefined,
  made: GridSegment[],
  from: number,
  to: number,
  duration: number,
  mkId: () => string,
): GridSegment[] {
  const segs = sortedSegments(existing)
  const out: GridSegment[] = []
  segs.forEach((s, i) => {
    const end = segmentEnd(segs, i, duration)
    if (end <= from + 1e-6 || s.start >= to - 1e-6) {
      out.push(s)
      return
    }
    if (s.start < from - 1e-6) out.push({ ...s, end: from })
    if (end > to + 1e-6) {
      const bar = barLength(s)
      const resume = s.start + Math.ceil((to - s.start) / bar - 1e-9) * bar
      if (resume < end - 1e-6) {
        const rest: GridSegment = { ...s, id: mkId(), start: resume }
        delete rest.firstBar
        out.push(rest)
      }
    }
  })
  const last = made[made.length - 1]
  // The last new stretch stops at `to` unless a stretch starts right there.
  const tail = last && !out.some((s) => Math.abs(s.start - to) < 1e-6) ? [...made.slice(0, -1), { ...last, end: to }] : made
  return sortedSegments([...out, ...tail])
}
