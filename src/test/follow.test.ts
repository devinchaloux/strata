/**
 * Following the playhead (lib/timeline: followOffset, revealOffset) and double
 * tap (lib/doubleTap). The view follows a playhead that walks off the view and
 * shows where a seek lands, but leaves a playhead the reader scrolled away from.
 */
import { describe, it, expect } from 'vitest'
import { followOffset, revealOffset } from '@/lib/timeline'
import { isDoubleTap, DOUBLE_TAP_MS } from '@/lib/doubleTap'

// 10 px a second, a 300 px view over a 3000 px track.
const view = { pps: 10, viewportWidth: 300, totalWidth: 3000 }

describe('followOffset', () => {
  it('leaves the view alone while the playhead is well inside it', () => {
    expect(followOffset({ ...view, scrollOffset: 0, prevTime: 10, time: 10.25 })).toBeNull()
  })

  it('follows at 80% once the playhead walks past it', () => {
    // 24.25 s is 242.5 px, past 80% of 300 (240).
    expect(followOffset({ ...view, scrollOffset: 0, prevTime: 24, time: 24.25 })).toBeCloseTo(242.5 - 240)
  })

  it('leaves a playhead the reader scrolled away from', () => {
    // The reader scrolled ahead to 1000 px (100 s); the playhead at 20 s is off the left.
    expect(followOffset({ ...view, scrollOffset: 1000, prevTime: 20, time: 20.25 })).toBeNull()
    // ...or back before it: the playhead at 200 s is off the right.
    expect(followOffset({ ...view, scrollOffset: 0, prevTime: 200, time: 200.25 })).toBeNull()
  })

  it('picks the playhead up again once it walks back into view', () => {
    // Scrolled ahead to 100 s; the playhead walks in at the left, then on to 80%.
    expect(followOffset({ ...view, scrollOffset: 1000, prevTime: 99.9, time: 100.1 })).toBeNull()
    expect(followOffset({ ...view, scrollOffset: 1000, prevTime: 124, time: 124.25 })).toBeCloseTo(1242.5 - 240)
  })

})

describe('revealOffset', () => {
  it('shows a seek that lands off screen at 20%', () => {
    expect(revealOffset({ ...view, scrollOffset: 0, time: 150 })).toBeCloseTo(1500 - 60)
    // Back to the start from a view the reader scrolled ahead.
    expect(revealOffset({ ...view, scrollOffset: 1000, time: 0 })).toBe(0)
  })

  it('moves nothing for a seek that lands in view', () => {
    expect(revealOffset({ ...view, scrollOffset: 0, time: 20 })).toBeNull()
  })
})

describe('isDoubleTap', () => {
  it('counts a second tap on the same thing in time, and starts afresh after', () => {
    expect(isDoubleTap('span:a', 1000)).toBe(false)
    expect(isDoubleTap('span:a', 1000 + DOUBLE_TAP_MS - 1)).toBe(true)
    expect(isDoubleTap('span:a', 1000 + DOUBLE_TAP_MS + 50)).toBe(false)
  })

  it('ignores a second tap that is too late or on something else', () => {
    expect(isDoubleTap('span:b', 5000)).toBe(false)
    expect(isDoubleTap('span:b', 5000 + DOUBLE_TAP_MS + 1)).toBe(false)
    expect(isDoubleTap('span:c', 5000 + DOUBLE_TAP_MS + 100)).toBe(false)
  })
})
