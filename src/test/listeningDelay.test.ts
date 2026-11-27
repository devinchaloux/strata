import { describe, it, expect, beforeEach } from 'vitest'
import { PlayheadClock, clampDelayMs, shiftAllTimes, MAX_LISTENING_DELAY_MS } from '@/lib/listeningDelay'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'
import type { Layer, SegmentationData, WrittenAnalysisData } from '@/types/strata'

describe('clampDelayMs', () => {
  it('keeps a whole number of ms inside the range', () => {
    expect(clampDelayMs(212.4)).toBe(212)
    expect(clampDelayMs(-10)).toBe(0)
    expect(clampDelayMs(9999)).toBe(MAX_LISTENING_DELAY_MS)
    expect(clampDelayMs(NaN)).toBe(0)
  })
})

describe('PlayheadClock', () => {
  it('is the reading while stopped, whatever the delay', () => {
    const c = new PlayheadClock()
    expect(c.read(10, 'stopped', 200, 1)).toBe(10)
  })

  it('takes the delay off while playing, scaled by the rate', () => {
    const c = new PlayheadClock()
    c.seek(0)
    expect(c.read(10, 'playing', 200, 1)).toBeCloseTo(9.8)
    const slow = new PlayheadClock()
    slow.seek(0)
    expect(slow.read(10, 'playing', 200, 0.5)).toBeCloseTo(9.9)
  })

  it('holds at the paused position until the heard time catches up, instead of stepping back', () => {
    const c = new PlayheadClock()
    c.read(30, 'stopped', 200, 1) // paused at 30
    expect(c.read(30.05, 'playing', 200, 1)).toBe(30) // heard 29.85: hold
    expect(c.read(30.15, 'playing', 200, 1)).toBe(30)
    expect(c.read(30.3, 'playing', 200, 1)).toBeCloseTo(30.1) // caught up
  })

  it('holds through YouTube running on and snapping back as playback starts', () => {
    const c = new PlayheadClock()
    c.read(30, 'stopped', 0, 1)
    expect(c.read(30.3, 'playing', 0, 1)).toBeCloseTo(30.3) // ran on
    expect(c.read(30, 'playing', 0, 1)).toBeCloseTo(30.3) // snapped back: held
    expect(c.read(30.4, 'playing', 0, 1)).toBeCloseTo(30.4)
  })

  it('holds while buffering', () => {
    const c = new PlayheadClock()
    c.seek(50)
    expect(c.read(51, 'buffering', 200, 1)).toBe(50)
  })

  it('follows a real jump back', () => {
    const c = new PlayheadClock()
    c.seek(0)
    c.read(60, 'playing', 200, 1)
    expect(c.read(10, 'playing', 200, 1)).toBeCloseTo(9.8)
  })

  it('starts from where a seek landed', () => {
    const c = new PlayheadClock()
    c.read(80, 'stopped', 200, 1)
    c.seek(20)
    expect(c.read(20.1, 'playing', 200, 1)).toBe(20)
  })

  it('peek does not move the clock', () => {
    const c = new PlayheadClock()
    c.seek(0)
    c.peek(40, 'playing', 0, 1)
    expect(c.read(1, 'playing', 0, 1)).toBe(1)
  })
})

function commentary(blocks: WrittenAnalysisData['blocks']): Layer {
  return { id: 'w', type: 'written-analysis', label: 'Commentary', data: { blocks } } as Layer
}

describe('shiftAllTimes', () => {
  const doc = makeDoc(
    [
      makeLayer('a', [makeSpan('s1', 0, 10.2), makeSpan('s2', 10.2, 50.2), makeSpan('s3', 50.2, 100)]),
      commentary([
        { id: 'b1', anchor: { spanId: 's2' }, text: 'x' },
        { id: 'b2', anchor: { start: 20.2, end: 30.2 }, text: 'y' },
      ]),
    ],
    {
      pointMarkers: [{ id: 'm', timestamp: 40.2 }],
      beatGrid: [{ id: 'g', start: 0.7, end: 90.2, bpm: 126, beatsPerBar: 4 }],
    },
  )

  it('moves every time earlier, keeping 0:00 and the end', () => {
    const r = shiftAllTimes(doc, -0.2)
    if (!r.ok) throw new Error(r.reason)
    const spans = (r.document.layers[0].data as SegmentationData).spans
    expect(spans.map((s) => [s.startTime, s.endTime])).toEqual([[0, 10], [10, 50], [50, 100]])
    expect(r.document.pointMarkers[0].timestamp).toBe(40)
    expect(r.document.beatGrid![0]).toMatchObject({ start: 0.5, end: 90 })
    const blocks = (r.document.layers[1].data as WrittenAnalysisData).blocks
    expect(blocks[0].anchor).toEqual({ spanId: 's2' })
    expect(blocks[1].anchor).toEqual({ start: 20, end: 30 })
  })

  it('refuses rather than squeeze a span out', () => {
    const tight = makeDoc([makeLayer('a', [makeSpan('s1', 0, 0.3, { label: 'Intro' }), makeSpan('s2', 0.3, 100)])])
    const r = shiftAllTimes(tight, -0.2)
    expect(r.ok).toBe(false)
  })

  it('is one undoable store action', () => {
    useDocumentStore.setState({ document: doc })
    useDocumentStore.temporal.getState().clear()
    expect(useDocumentStore.getState().shiftAllTimes(-0.2)).toBeNull()
    expect(useDocumentStore.getState().document!.pointMarkers[0].timestamp).toBe(40)
    useDocumentStore.temporal.getState().undo()
    expect(useDocumentStore.getState().document!.pointMarkers[0].timestamp).toBe(40.2)
  })
})

beforeEach(() => {
  useDocumentStore.setState({ document: null })
})
