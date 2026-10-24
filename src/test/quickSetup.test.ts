// @vitest-environment jsdom
/**
 * Quick setup: tiling a layer with a span every N bars, and moving a span's
 * end by whole bars with every later boundary following.
 */
import { describe, it, expect } from 'vitest'
import type { GridSegment, Span } from '@/types/strata'
import { barTiling } from '@/lib/beatGrid'
import { rippleSpanEnd, extendSpanToEnd } from '@/lib/spanEdit'
import { useDocumentStore } from '@/store/documentStore'
import { formSpans } from '@/lib/layers'
import { makeDoc, makeLayer } from './fixtures'

// 120 BPM in 4/4: a bar is 2 s, four bars 8 s.
const seg = (id: string, start: number, extra: Partial<GridSegment> = {}): GridSegment => ({
  id, start, bpm: 120, beatsPerBar: 4, ...extra,
})
const span = (id: string, startTime: number, endTime: number): Span => ({ id, startTime, endTime })
const times = (spans: Span[]) => spans.map((s) => [+s.startTime.toFixed(3), +s.endTime.toFixed(3)])

describe('barTiling', () => {
  it('lays a boundary every N bars, the last span taking what is left', () => {
    expect(barTiling([seg('a', 1)], 30, 1, 4)).toEqual([1, 9, 17, 25, 30])
  })

  it('starts on the bar line nearest the start', () => {
    expect(barTiling([seg('a', 0)], 20, 2.3, 4)).toEqual([2, 10, 18, 20])
  })

  it('folds a leftover under a tenth of a bar into the span before', () => {
    expect(barTiling([seg('a', 0)], 16.1, 0, 4)).toEqual([0, 8, 16.1])
  })

  it('stops where the grid stops', () => {
    expect(barTiling([seg('a', 0, { end: 20 }), seg('b', 40)], 100, 0, 4)).toEqual([0, 8, 16, 20])
  })

  it('is empty in a free stretch', () => {
    expect(barTiling([seg('a', 0, { end: 20 })], 100, 30, 4)).toEqual([])
  })
})

describe('rippleSpanEnd', () => {
  const spans = [span('a', 0, 8), span('b', 8, 16), span('c', 16, 24), span('d', 24, 30)]

  it('lengthens a span by a bar and moves every later boundary with it', () => {
    expect(times(rippleSpanEnd(spans, 'b', 2, 30)!)).toEqual([[0, 8], [8, 18], [18, 26], [26, 30]])
  })

  it('shortens a span, the last span stretching to the layer end', () => {
    expect(times(rippleSpanEnd(spans, 'a', -2, 30)!)).toEqual([[0, 6], [6, 14], [14, 22], [22, 30]])
  })

  it('drops a span pushed past the end of the layer', () => {
    const r = rippleSpanEnd(spans, 'a', 6, 30)!
    expect(times(r)).toEqual([[0, 14], [14, 22], [22, 30]])
  })

  it('moves only the end of the last span, within the track', () => {
    expect(times(rippleSpanEnd(spans, 'd', 2, 31)!)[3]).toEqual([24, 31])
  })

  it('refuses to shrink a span to nothing', () => {
    expect(rippleSpanEnd(spans, 'd', -6, 30)).toBeNull()
  })
})

describe('extendSpanToEnd', () => {
  const spans = [span('a', 0, 8), span('b', 8, 16), span('c', 16, 24), span('d', 24, 30)]

  it('runs a span to the end and drops the spans after it', () => {
    expect(times(extendSpanToEnd(spans, 'b', 30)!)).toEqual([[0, 8], [8, 30]])
  })

  it('reaches the track end past the last span', () => {
    expect(times(extendSpanToEnd([span('a', 0, 8)], 'a', 30)!)).toEqual([[0, 30]])
  })

  it('does nothing for a last span already at the end', () => {
    expect(extendSpanToEnd(spans, 'd', 30)).toBeNull()
  })
})

describe('in the store', () => {
  const store = () => useDocumentStore.getState()
  const load = (extra = {}) => {
    const layer = makeLayer('L')
    store().loadDocument({ ...makeDoc([layer]), duration: 30, bpm: 120, timeSignature: { numerator: 4, denominator: 4 }, ...extra })
    return layer.id
  }
  const layerSpans = (id: string) => formSpans(store().document!.layers.find((l) => l.id === id)!)

  it('fills an empty layer from the tempo, starting a grid there', () => {
    const id = load()
    expect(store().fillLayerWithBars(id, 1, 4)).toBe(4)
    expect(store().document!.beatGrid).toMatchObject([{ start: 1, bpm: 120, beatsPerBar: 4 }])
    expect(times(layerSpans(id))).toEqual([[1, 9], [9, 17], [17, 25], [25, 30]])
  })

  it('needs a tempo when there is no grid', () => {
    const id = load({ bpm: null })
    expect(store().fillLayerWithBars(id, 0, 4)).toBe(0)
    expect(layerSpans(id)).toEqual([])
  })

  it('makes a phrase a bar longer', () => {
    const id = load()
    store().fillLayerWithBars(id, 0, 4)
    store().resizeSpanByBars(id, layerSpans(id)[0].id, 1)
    expect(times(layerSpans(id))).toEqual([[0, 10], [10, 18], [18, 26], [26, 30]])
  })

  it('makes a phrase a typed number of bars, the rest moving back into step', () => {
    const id = load()
    store().fillLayerWithBars(id, 0, 4)
    // A two-bar break where the second phrase starts: every later phrase moves two bars earlier.
    store().setSpanBars(id, layerSpans(id)[1].id, 2)
    expect(times(layerSpans(id))).toEqual([[0, 8], [8, 12], [12, 20], [20, 30]])
  })

  it('extends a phrase to the end over an unmetered ending, in one step', () => {
    const id = load()
    store().fillLayerWithBars(id, 0, 4)
    store().extendToEnd(id, layerSpans(id)[1].id)
    expect(times(layerSpans(id))).toEqual([[0, 8], [8, 30]])
  })
})
