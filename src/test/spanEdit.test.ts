import { describe, it, expect } from 'vitest'
import { placeBoundaryInSpans, MIN_SPAN_WIDTH } from '@/lib/spanEdit'
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

  it('no-ops when the time is on a boundary or outside every span', () => {
    const spans = [span('a', 0, 40), span('b', 40, 100)]
    expect(placeBoundaryInSpans(spans, 40, 100, mkId)).toBeNull() // exactly on a boundary
    expect(placeBoundaryInSpans([span('a', 0, 40)], 80, 100, mkId)).toBeNull() // in a gap
  })

  it('no-ops when the cut would be narrower than the minimum width', () => {
    const spans = [span('a', 0, 100)]
    expect(placeBoundaryInSpans(spans, MIN_SPAN_WIDTH / 2, 100, mkId)).toBeNull()
    expect(placeBoundaryInSpans(spans, 100 - MIN_SPAN_WIDTH / 2, 100, mkId)).toBeNull()
  })
})
