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
  extendBack,
} from '@/lib/beatGrid'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

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
  const store = () => useDocumentStore.getState()
  const grid = () => store().document!.beatGrid!.map((g) => [+g.start.toFixed(2), g.end ?? null, g.bpm])

  it('reaches back to the last section boundary before the taps', () => {
    // A section starts at 4 s; tapping (120 BPM, 2 s bars) begins a bar later.
    store().loadDocument({ ...makeDoc([makeLayer('L', [makeSpan('a', 0, 4), makeSpan('b', 4, 60)])]), duration: 200 })
    const id = store().layGridFromTaps(6, 120)
    expect(grid()).toEqual([[4, null, 120]])
    store().layGridFromTaps(6.02, 120, id) // the same run, refined
    expect(store().document!.beatGrid).toHaveLength(1)
  })

  it('keeps a free stretch free when the grid is picked up after it', () => {
    store().loadDocument({ ...makeDoc([makeLayer('L', [makeSpan('a', 0, 40), makeSpan('b', 44, 100)])]), duration: 200 })
    store().layGridFromTaps(0, 120)
    store().endGridAt(40) // the breakdown, 40–44
    store().layGridFromTaps(48, 120) // tapping two bars after the beat returns at 44
    expect(grid()).toEqual([[0, 40, 120], [44, null, 120]])
  })

  it('marks a tempo change, not a reach back, inside a running segment', () => {
    store().loadDocument({ ...makeDoc([]), duration: 200 })
    store().layGridFromTaps(0, 120)
    store().layGridFromTaps(50, 126)
    expect(grid()).toEqual([[0, null, 120], [50, null, 126]])
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
  it('rounds the tempo to a whole BPM and fits the start to it', () => {
    expect(fitTaps([10, 10.5, 11])).toBeNull()
    // Twelve hand taps at 120 BPM with ±15 ms of wobble: 120 exactly, start near 10.
    const wobble = [0.01, -0.015, 0.012, 0, -0.01, 0.015, -0.012, 0.005, -0.008, 0.01, -0.005, 0]
    const fit = fitTaps(wobble.map((w, i) => 10 + i * 0.5 + w))!
    expect(fit.bpm).toBe(120)
    expect(fit.start).toBeCloseTo(10, 1)
  })
})

describe('extendBack', () => {
  it('reaches back by whole bars to the floor', () => {
    // 2 s bars; tapping began at 10.0 with music from 4.0 → the grid starts at 4.
    expect(extendBack(10, 2, 4)).toBeCloseTo(4)
    // A boundary placed a hair late (4.1) still takes the bar at 4.
    expect(extendBack(10, 2, 4.1)).toBeCloseTo(4)
    expect(extendBack(10, 2, 10)).toBe(10)
  })
})

describe('barAt', () => {
  it("numbers bars as the ruler does, and none in a free stretch", async () => {
    const { barAt } = await import('@/lib/beatGrid')
    const segs = sortedSegments([seg('a', 0, { end: 20 }), seg('b', 40)])
    expect(barAt(segs, 0, 100)).toBe(1)
    expect(barAt(segs, 3.9, 100)).toBe(2)
    expect(barAt(segs, 30, 100)).toBeNull()
    expect(barAt(segs, 40, 100)).toBe(11)
  })
})
