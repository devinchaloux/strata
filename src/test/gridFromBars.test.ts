import { describe, it, expect } from 'vitest'
import { gridFromBars, spliceGrid } from '@/lib/gridFromBars'
import { gridLines, firstBarNumbers, sortedSegments } from '@/lib/beatGrid'
import type { GridSegment, Layer, Span } from '@/types/strata'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer } from './fixtures'

let n = 0
const id = () => `g${n++}`
const bar = (start: number, end: number, label?: string): Pick<Span, 'startTime' | 'endTime' | 'label'> => ({ startTime: start, endTime: end, label })
const four = () => 4

describe('gridFromBars', () => {
  it('makes a stretch per bar at the bar\'s own tempo, numbered from the first bar\'s label', () => {
    const segs = gridFromBars([bar(0, 4, '1'), bar(4, 7, '2'), bar(7, 9, '3')], four, id)
    expect(segs.map((s) => [s.start, s.bpm, s.firstBar, s.end])).toEqual([
      [0, 60, 1, undefined],
      [4, 80, undefined, undefined],
      [7, 120, undefined, 9],
    ])
  })

  it('merges bars at the same tempo into one stretch', () => {
    const segs = gridFromBars([bar(0, 2), bar(2, 4), bar(4, 6), bar(6, 7)], four, id)
    expect(segs.map((s) => [s.start, s.bpm])).toEqual([[0, 120], [6, 240]])
  })

  it('leaves a gap between runs free and renumbers after it', () => {
    const segs = gridFromBars([bar(0, 2, '1'), bar(2, 4, '2'), bar(10, 12, '9')], four, id)
    expect(segs.map((s) => [s.start, s.end, s.firstBar])).toEqual([[0, 4, 1], [10, 12, 9]])
  })

  it('takes the meter from the grid at each bar, and gives a beat unit other than 4', () => {
    const segs = gridFromBars([bar(0, 3), bar(3, 5)], (t) => (t < 3 ? 3 : 2), id, 8)
    expect(segs.map((s) => [s.beatsPerBar, s.bpm, s.beatUnit])).toEqual([[3, 60, 8], [2, 60, 8]])
  })

  it('puts a downbeat on every bar, and numbers them as labelled', () => {
    const bars = [bar(0, 7.97, '1'), bar(7.97, 15.59, '2'), bar(15.59, 22.84, '3'), bar(22.84, 29.81, '4')]
    const segs = gridFromBars(bars, four, id)
    const downbeats = gridLines(segs, 29.81, 0, 29.81).filter((l) => l.bar !== null)
    expect(downbeats.map((l) => [Math.round(l.time * 100) / 100, l.bar])).toEqual([[0, 1], [7.97, 2], [15.59, 3], [22.84, 4]])
  })
})

describe('spliceGrid', () => {
  const old: GridSegment = { id: 'old', start: 0, bpm: 120, beatsPerBar: 4 } // a bar every 2 s, to the end
  const made = (from: number, to: number) => gridFromBars([bar(from, to)], four, id)

  it('replaces the covered stretch, stops the one before and resumes it on its own downbeat after', () => {
    const segs = sortedSegments(spliceGrid([old], made(5, 9), 5, 9, 20, id))
    expect(segs.map((s) => [s.start, s.end ?? null])).toEqual([[0, 5], [5, 9], [10, null]])
    // The resumed stretch keeps the old bar lines: 10, 12, 14 …
    const lines = gridLines(segs, 20, 10, 20).filter((l) => l.bar !== null).map((l) => l.time)
    expect(lines.slice(0, 3)).toEqual([10, 12, 14])
    expect(firstBarNumbers(segs, 20)).toHaveLength(3)
  })

  it('needs no grid to put one in', () => {
    expect(spliceGrid(undefined, made(0, 4), 0, 4, 10, id).map((s) => [s.start, s.end])).toEqual([[0, 4]])
  })
})

describe('gridFromBars in the store', () => {
  const store = () => useDocumentStore.getState()
  // An accelerando: 4 s, 3 s, 2 s, 2 s bars, labelled 1–4.
  const taps = [0, 4, 7, 9, 11]
  const spans: Span[] = taps.slice(1).map((t, k) => ({ id: `b${k}`, startTime: taps[k], endTime: t, label: String(k + 1) }))
  const load = (grid?: GridSegment[]) =>
    store().loadDocument(makeDoc([{ ...makeLayer('Bars', spans), role: 'bars' } as Layer], { duration: 20, beatGrid: grid }))

  it('makes the grid from every bar of the bar layer, merging the steady ones', () => {
    load()
    expect(store().gridFromBars(null)).toEqual({ stretches: 3, bars: 4 })
    const segs = store().document!.beatGrid!
    expect(segs.map((s) => [s.start, s.bpm, s.firstBar ?? null, s.end ?? null])).toEqual([
      [0, 60, 1, null],
      [4, 80, null, null],
      [7, 120, null, 11],
    ])
    useDocumentStore.temporal.getState().undo()
    expect(store().document!.beatGrid).toBeUndefined()
  })

  it('makes it from selected bars only, keeping the grid around them', () => {
    load([{ id: 'old', start: 0, bpm: 60, beatsPerBar: 4 }])
    store().gridFromBars(['b1', 'b2'])
    const segs = store().document!.beatGrid!
    expect(segs.map((s) => [s.start, Math.round(s.bpm), s.end ?? null])).toEqual([
      [0, 60, 4],
      [4, 80, null], // the next stretch starts at its end, so it needs none
      [7, 120, 9],
      [12, 60, null], // the old grid resumes on its own downbeat after the bars
    ])
  })
})
