import { describe, it, expect } from 'vitest'
import { spanNeighbour, firstSpan, spanRange } from '@/lib/spanNav'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

// Top layer T (displayOrder highest) over middle M over bottom B.
const doc = (() => {
  const d = makeDoc([
    makeLayer('T', [makeSpan('t1', 0, 60), makeSpan('t2', 60, 120)]),
    makeLayer('M', [makeSpan('m1', 0, 30), makeSpan('m2', 30, 60), makeSpan('m3', 80, 120)]),
    makeLayer('B', [makeSpan('b1', 0, 120)]),
  ])
  d.layers.forEach((l, i) => (l.displayOrder = 10 - i))
  return d
})()

describe('spanNeighbour', () => {
  it('moves left and right in time order, stopping at the edges', () => {
    expect(spanNeighbour(doc, 'm2', 'right')).toBe('m3')
    expect(spanNeighbour(doc, 'm2', 'left')).toBe('m1')
    expect(spanNeighbour(doc, 'm1', 'left')).toBeNull()
  })

  it('moves up and down to the span over the middle', () => {
    expect(spanNeighbour(doc, 't2', 'down')).toBe('m3')
    expect(spanNeighbour(doc, 'm1', 'up')).toBe('t1')
    expect(spanNeighbour(doc, 'm3', 'down')).toBe('b1')
    expect(spanNeighbour(doc, 't1', 'up')).toBeNull()
  })

  it('takes the nearest span when the middle falls in a gap', () => {
    // x's middle (72) falls in M's gap: 8 from m3, 12 from m2.
    const d = makeDoc([makeLayer('T', [makeSpan('x', 64, 80)]), makeLayer('M', [makeSpan('m2', 30, 60), makeSpan('m3', 80, 120)])])
    d.layers[0].displayOrder = 5
    d.layers[1].displayOrder = 1
    expect(spanNeighbour(d, 'x', 'down')).toBe('m3')
  })

  it('skips hidden layers', () => {
    const d = structuredClone(doc)
    d.layers[1].visibility = false
    expect(spanNeighbour(d, 't1', 'down')).toBe('b1')
  })
})

describe('firstSpan and spanRange', () => {
  it('starts at the given layer, else the top one', () => {
    expect(firstSpan(doc, 'M')).toBe('m1')
    expect(firstSpan(doc, null)).toBe('t1')
  })
  it('gives the run between two spans of one layer, either way round', () => {
    expect(spanRange(doc, 'm3', 'm1')).toEqual(['m1', 'm2', 'm3'])
    expect(spanRange(doc, 'm1', 't1')).toBeNull()
  })
})
