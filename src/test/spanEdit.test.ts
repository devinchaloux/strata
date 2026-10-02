import { describe, it, expect } from 'vitest'
import { placeBoundaryInSpans, endSpanAtTime, snapSpansToGrid, MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import type { Span } from '@/types/strata'

let idCounter = 0
const mkId = () => `new-${++idCounter}`

function span(id: string, startTime: number, endTime: number, extra: Partial<Span> = {}): Span {
  return { id, startTime, endTime, ...extra }
}

describe('placeBoundaryInSpans', () => {
  it('seeds two spans on an empty layer', () => {
    const result = placeBoundaryInSpans([], 30, 100, mkId)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(2)
    expect(result![0]).toMatchObject({ startTime: 0, endTime: 30 })
    expect(result![1]).toMatchObject({ startTime: 30, endTime: 100 })
  })

  it('splits the span that contains the time', () => {
    const spans = [span('a', 0, 40), span('b', 40, 100)]
    const result = placeBoundaryInSpans(spans, 60, 100, mkId)
    expect(result).toHaveLength(3)
    expect(result!.map((s) => [s.startTime, s.endTime])).toEqual([
      [0, 40],
      [40, 60],
      [60, 100],
    ])
  })

  it('marks the new inner faces definite, keeps outer boundary character', () => {
    const spans = [span('a', 0, 100, { startBoundaryType: 'gradual', endBoundaryType: 'elided' })]
    const result = placeBoundaryInSpans(spans, 50, 100, mkId)!
    const [left, right] = result
    expect(left.startBoundaryType).toBe('gradual') // outer preserved
    expect(left.endBoundaryType).toBe('definite') // new cut
    expect(right.startBoundaryType).toBe('definite') // new cut
    expect(right.endBoundaryType).toBe('elided') // outer preserved
  })

  it('both halves inherit attributes; right half gets a fresh id', () => {
    const spans = [span('a', 0, 100, { type: 'drop', label: 'Drop', fillColor: '#fff' })]
    const result = placeBoundaryInSpans(spans, 50, 100, mkId)!
    expect(result[0].id).toBe('a')
    expect(result[1].id).not.toBe('a')
    expect(result[0]).toMatchObject({ type: 'drop', label: 'Drop', fillColor: '#fff' })
    expect(result[1]).toMatchObject({ type: 'drop', label: 'Drop', fillColor: '#fff' })
  })

  it('no-ops when the time is exactly on a boundary', () => {
    const spans = [span('a', 0, 40), span('b', 40, 100)]
    expect(placeBoundaryInSpans(spans, 40, 100, mkId)).toBeNull()
  })
  // Placing a boundary inside a gap fills it (2026-09-27); see tiling.test.ts.

  it('no-ops when the cut would be narrower than the minimum width', () => {
    const spans = [span('a', 0, 100)]
    expect(placeBoundaryInSpans(spans, MIN_SPAN_WIDTH / 2, 100, mkId)).toBeNull()
    expect(placeBoundaryInSpans(spans, 100 - MIN_SPAN_WIDTH / 2, 100, mkId)).toBeNull()
  })
})

describe('placeBoundaryInSpans without filling gaps', () => {
  it('on an empty layer, starts one span at the boundary', () => {
    const result = placeBoundaryInSpans([], 30, 100, mkId, false)
    expect(result!.map((s) => [s.startTime, s.endTime])).toEqual([[30, 100]])
  })

  it('in a gap, runs only to the next span', () => {
    const spans = [span('a', 0, 20), span('b', 60, 100)]
    const result = placeBoundaryInSpans(spans, 40, 100, mkId, false)
    expect(result!.map((s) => [s.startTime, s.endTime])).toEqual([
      [0, 20],
      [40, 60],
      [60, 100],
    ])
  })

  it('still splits a span the boundary falls inside', () => {
    const result = placeBoundaryInSpans([span('a', 0, 100)], 50, 100, mkId, false)
    expect(result).toHaveLength(2)
  })
})

describe('endSpanAtTime', () => {
  it('truncates the span under the time and leaves the rest empty', () => {
    const spans = [span('a', 0, 100, { endCap: 'elision', endOnTop: true })]
    const result = endSpanAtTime(spans, 40)!
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startTime: 0, endTime: 40 })
    expect(result[0].endCap).toBeUndefined()
    expect(result[0].endOnTop).toBeUndefined()
  })

  it('is a no-op in a gap or too near an edge', () => {
    const spans = [span('a', 0, 20)]
    expect(endSpanAtTime(spans, 50)).toBeNull()
    expect(endSpanAtTime(spans, MIN_SPAN_WIDTH / 2)).toBeNull()
  })
})

describe('snapSpansToGrid', () => {
  const toTens = (t: number) => Math.round(t / 10) * 10

  it('moves shared boundaries once, for both spans', () => {
    const spans = [span('a', 0, 18), span('b', 18, 41), span('c', 41, 100)]
    const { spans: out, moved } = snapSpansToGrid(spans, toTens)
    expect(moved).toBe(2)
    expect(out.map((s) => [s.startTime, s.endTime])).toEqual([
      [0, 20],
      [20, 40],
      [40, 100],
    ])
  })

  it('leaves a boundary whose snap would collapse a span', () => {
    // 12 and 14 both snap to 10: the second stays put.
    const spans = [span('a', 0, 12), span('b', 12, 14), span('c', 14, 100)]
    const { spans: out } = snapSpansToGrid(spans, toTens)
    expect(out.every((s) => s.endTime - s.startTime >= MIN_SPAN_WIDTH)).toBe(true)
  })

  it('reports nothing moved when already on the grid', () => {
    expect(snapSpansToGrid([span('a', 0, 50), span('b', 50, 100)], toTens).moved).toBe(0)
  })
})
