/**
 * Re-tapping (lib/retap.ts; docs/decisions.md, "Re-Tapping Boundaries"):
 * which boundary a tap is for, and where its taps put it.
 */
import { describe, it, expect } from 'vitest'
import { retapTarget, retapTime, RETAP_REACH } from '@/lib/retap'
import { makeSpan } from './fixtures'

// Bars of 2 s: boundaries at 2, 4, 6.
const bars = [makeSpan('a', 0, 2), makeSpan('b', 2, 4), makeSpan('c', 4, 6), makeSpan('d', 6, 8)]

describe('retapTarget', () => {
  it('finds the nearest boundary between touching spans', () => {
    expect(retapTarget(bars, 4.05)).toEqual({ leftId: 'b', rightId: 'c', time: 4 })
    expect(retapTarget(bars, 1.95)).toEqual({ leftId: 'a', rightId: 'b', time: 2 })
  })

  it('reaches no further than 40% of the shorter span beside it', () => {
    expect(retapTarget(bars, 4 + 2 * RETAP_REACH - 0.01)?.rightId).toBe('c')
    expect(retapTarget(bars, 5)).toBeNull()
  })

  it('ignores the ends of the layer and boundaries across a gap', () => {
    expect(retapTarget(bars, 0.1)).toBeNull()
    const gapped = [makeSpan('a', 0, 2), makeSpan('b', 2.5, 4)]
    expect(retapTarget(gapped, 2.2)).toBeNull()
  })

  it('reads the spans in time order, whatever order they are stored in', () => {
    expect(retapTarget([...bars].reverse(), 6.1)?.rightId).toBe('d')
  })
})

describe('retapTime', () => {
  it('is the average of the taps', () => {
    expect(retapTime([4.03])).toBeCloseTo(4.03, 9)
    expect(retapTime([4.03, 3.99, 4.01])).toBeCloseTo(4.01, 9)
  })
})
