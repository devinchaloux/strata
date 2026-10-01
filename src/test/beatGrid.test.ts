import { describe, it, expect } from 'vitest'
import type { GridSegment } from '@/types/strata'
import {
  firstBarNumbers,
  gridLines,
  segmentAt,
  segmentEnd,
  snapToGrid,
  sortedSegments,
  fitTaps,
} from '@/lib/beatGrid'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { makeDoc } from './fixtures'

// 120 BPM in 4/4: a beat is 0.5 s, a bar 2 s.
const seg = (id: string, start: number, extra: Partial<GridSegment> = {}): GridSegment => ({
  id, start, bpm: 120, beatsPerBar: 4, ...extra,
})

describe('segments', () => {
  const segs = sortedSegments([seg('b', 40), seg('a', 0, { end: 20 })])

  it('end at their own end, the next start, or the track end', () => {
    expect(segmentEnd(segs, 0, 100)).toBe(20)
    expect(segmentEnd(segs, 1, 100)).toBe(100)
  })

  it('leave free stretches between them', () => {
    expect(segmentAt(segs, 10, 100)?.seg.id).toBe('a')
    expect(segmentAt(segs, 30, 100)).toBeNull()
    expect(segmentAt(segs, 41, 100)?.seg.id).toBe('b')
  })
})

describe('bar numbers', () => {
  it('continue across a free stretch', () => {
    // 0–20 s is ten bars (1–10); the grid resumes at 40 s with bar 11.
    expect(firstBarNumbers(sortedSegments([seg('a', 0, { end: 20 }), seg('b', 40)]), 100)).toEqual([1, 11])
  })

  it('count a cut-short last bar, but not a sliver', () => {
    // 21 s = 10.5 bars → 11 bars; 20.1 s = 10.05 bars → 10 bars.
    expect(firstBarNumbers(sortedSegments([seg('a', 0, { end: 21 }), seg('b', 40)]), 100)[1]).toBe(12)
    expect(firstBarNumbers(sortedSegments([seg('a', 0, { end: 20.1 }), seg('b', 40)]), 100)[1]).toBe(11)
  })

  it('take an override where the analyst sets one', () => {
    expect(firstBarNumbers(sortedSegments([seg('a', 0, { end: 20 }), seg('b', 40, { firstBar: 1 })]), 100)).toEqual([1, 1])
  })
})

describe('gridLines', () => {
  it('lists beats with bar numbers on downbeats, only inside segments', () => {
    const lines = gridLines(sortedSegments([seg('a', 0, { end: 4 }), seg('b', 10)]), 12, 0, 12)
    // No line at a segment's end: 4 s begins a free stretch, 12 s is the track's end.
    expect(lines.filter((l) => l.bar !== null).map((l) => [l.time, l.bar])).toEqual([
      [0, 1], [2, 2], [10, 3],
    ])
    expect(lines.some((l) => l.time > 4 && l.time < 10)).toBe(false)
  })

  it('falls back to downbeats alone when there would be too many lines', () => {
    const lines = gridLines([seg('a', 0)], 100, 0, 100, 50)
    expect(lines.every((l) => l.bar !== null)).toBe(true)
  })
})

describe('snapToGrid', () => {
  const segs = sortedSegments([seg('a', 1, { end: 21 })])
  it('pulls to the nearest beat or bar inside a segment', () => {
    expect(snapToGrid(2.2, segs, 100, 'beat')).toBeCloseTo(2)
    expect(snapToGrid(2.3, segs, 100, 'beat')).toBeCloseTo(2.5)
    expect(snapToGrid(2.3, segs, 100, 'bar')).toBeCloseTo(3)
  })
  it('leaves free stretches and "off" alone', () => {
    expect(snapToGrid(30.3, segs, 100, 'beat')).toBe(30.3)
    expect(snapToGrid(2.2, segs, 100, 'off')).toBe(2.2)
  })
})

describe('grid in the store', () => {
  it('starts, splits, stops and edits segments, carrying tempo forward', () => {
    const store = () => useDocumentStore.getState()
    store().loadDocument({ ...makeDoc([]), duration: 100, bpm: 128, timeSignature: { numerator: 4, denominator: 4 } })
    store().startGridAt(10)
    expect(store().document!.beatGrid).toMatchObject([{ start: 10, bpm: 128, beatsPerBar: 4, beatUnit: 4 }])
    store().endGridAt(40) // free stretch after 40 s
    store().startGridAt(52) // picked up again
    const segs = store().document!.beatGrid!
    expect(segs.map((g) => [g.start, g.end ?? null, g.bpm])).toEqual([[10, 40, 128], [52, null, 128]])
    store().updateGridSegment(segs[1].id, { bpm: 90, firstBar: 1 })
    expect(store().document!.beatGrid![1]).toMatchObject({ bpm: 90, firstBar: 1 })
    store().startGridAt(52.01) // a second press on the same downbeat does nothing
    expect(store().document!.beatGrid).toHaveLength(2)
    store().removeGridSegment(segs[0].id)
    expect(store().document!.beatGrid).toHaveLength(1)
  })
})

describe('tap-along in the store', () => {
  it('lays a segment from a tap run, refines it, and picks the grid up after a free stretch', () => {
    const store = () => useDocumentStore.getState()
    store().loadDocument({ ...makeDoc([]), duration: 200 })
    const id = store().layGridFromTaps(10, 118)
    store().layGridFromTaps(10.02, 120, id) // the same run, refined
    expect(store().document!.beatGrid!.map((g) => [g.start, g.bpm])).toEqual([[10.02, 120]])
    store().endGridAt(60) // the breakdown
    store().layGridFromTaps(64, 120) // tapping again where the beat returns
    expect(store().document!.beatGrid!.map((g) => [g.start, g.end ?? null])).toEqual([[10.02, 60], [64, null]])
    store().layGridFromTaps(64.1, 121) // a new run on the same downbeat refines, not stacks
    expect(store().document!.beatGrid).toHaveLength(2)
  })
})

describe('the snap preference', () => {
  it('is remembered in the browser', () => {
    useUIStore.getState().setSnapMode('bar')
    expect(localStorage.getItem('strata:snapMode')).toBe('bar')
    useUIStore.getState().setSnapMode('off')
    expect(localStorage.getItem('strata:snapMode')).toBe('off')
  })
})

describe('fitTaps', () => {
  it('fits the start and tempo of a run of taps', () => {
    expect(fitTaps([10, 10.5, 11])).toBeNull()
    // 120 BPM from 10 s, with a late first tap: the fitted start stays near 10.
    const fit = fitTaps([10.04, 10.5, 11.01, 11.49, 12, 12.5])!
    // Six hand taps, one 40 ms late, land within a couple of BPM; more taps refine it.
    expect(Math.abs(fit.bpm - 120)).toBeLessThan(2)
    expect(fit.start).toBeCloseTo(10, 1)
  })
})
