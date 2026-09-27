import { describe, it, expect, beforeEach } from 'vitest'
import { placeBoundaryInSpans, setSpanEdge, findOverlaps, gapAt, MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan as span } from './fixtures'

let n = 0
const mkId = () => `new-${++n}`
const ranges = (spans: { startTime: number; endTime: number }[] | null) =>
  spans?.map((s) => [s.startTime, s.endTime])

describe('gaps', () => {
  // A layer with a hole where a span was deleted: [0,40] · gap · [60,100]
  const holed = [span('a', 0, 40), span('c', 60, 100)]

  it('finds the gap around a time', () => {
    expect(gapAt(holed, 50, 100)).toEqual([40, 60])
    expect(gapAt(holed, 20, 100)).toBeNull()
    expect(gapAt([], 20, 100)).toEqual([0, 100])
  })

  it('fills a gap with two spans when a boundary is placed inside it', () => {
    expect(ranges(placeBoundaryInSpans(holed, 50, 100, mkId))).toEqual([
      [0, 40],
      [40, 50],
      [50, 60],
      [60, 100],
    ])
  })

  it('fills a leading or trailing gap up to the track edge', () => {
    expect(ranges(placeBoundaryInSpans([span('a', 30, 70)], 10, 100, mkId))).toEqual([
      [0, 10],
      [10, 30],
      [30, 70],
    ])
  })

  it('refuses a cut too close to the gap edge', () => {
    expect(placeBoundaryInSpans(holed, 40 + MIN_SPAN_WIDTH / 2, 100, mkId)).toBeNull()
  })

  it('does nothing exactly on a boundary', () => {
    expect(placeBoundaryInSpans(holed, 40, 100, mkId)).toBeNull()
  })
})

describe('findOverlaps', () => {
  it('reports overlapping pairs and ignores touching spans', () => {
    expect(findOverlaps([span('a', 0, 50), span('b', 50, 100)])).toEqual([])
    expect(findOverlaps([span('a', 0, 60), span('b', 50, 100)])).toEqual([['a', 'b']])
  })
})

describe('setSpanEdge', () => {
  const tiled = [span('a', 0, 40), span('b', 40, 70), span('c', 70, 100)]

  it('moves a shared boundary with its neighbour', () => {
    expect(ranges(setSpanEdge(tiled, 'b', 'start', 30, 100))).toEqual([
      [0, 30],
      [30, 70],
      [70, 100],
    ])
  })

  it('never squeezes the neighbour below the minimum width', () => {
    const out = setSpanEdge(tiled, 'b', 'start', -5, 100)!
    expect(out[0].endTime).toBe(MIN_SPAN_WIDTH)
    expect(out[1].startTime).toBe(MIN_SPAN_WIDTH)
  })

  it('stops an edge at the far side of a gap instead of overlapping', () => {
    const holed = [span('a', 0, 40), span('c', 60, 100)]
    expect(ranges(setSpanEdge(holed, 'c', 'start', 10, 100))).toEqual([
      [0, 40],
      [40, 100],
    ])
  })

  it('keeps the span at least the minimum width', () => {
    const out = setSpanEdge(tiled, 'b', 'end', 0, 100)!
    expect(out[1].endTime).toBe(40 + MIN_SPAN_WIDTH)
  })
})

describe('store tiling guard', () => {
  beforeEach(() => {
    useDocumentStore.getState().loadDocument(makeDoc([makeLayer('L', [span('a', 0, 50), span('b', 50, 100)])]))
  })
  const spans = () => useDocumentStore.getState().document!.layers[0].data.spans

  it('drops a write that would overlap two spans in a layer', () => {
    useDocumentStore.getState().addSpan('L', span('x', 20, 80))
    expect(spans().map((s) => s.id)).toEqual(['a', 'b'])
    useDocumentStore.getState().updateSpan('L', 'b', { startTime: 10 })
    expect(spans()[1].startTime).toBe(50)
  })

  it('still allows writes that keep the layer tiled', () => {
    useDocumentStore.getState().updateSpan('L', 'a', { label: 'Intro' })
    expect(spans()[0].label).toBe('Intro')
  })
})

describe('split and the outer-face drawing settings', () => {
  it("keeps an elision cap and the end drawing order on the original's outer ends", () => {
    const orig = span('a', 0, 100, { startCap: 'elision', endCap: 'elision', endOnTop: true })
    const [left, right] = placeBoundaryInSpans([orig], 50, 100, mkId)!
    expect(left).toMatchObject({ startCap: 'elision', endCap: undefined, endOnTop: undefined })
    expect(right).toMatchObject({ startCap: undefined, endCap: 'elision', endOnTop: true })
  })
})
