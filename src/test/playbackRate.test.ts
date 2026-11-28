import { describe, it, expect } from 'vitest'
import { clampRate, formatRate, rateRange } from '@/lib/playbackRate'

describe('playback speed', () => {
  it('goes slower on an audio file than on YouTube', () => {
    expect(rateRange('youtube').min).toBe(0.25)
    expect(rateRange('local').min).toBeLessThan(0.25)
  })
  it('keeps a custom speed inside the source range, to two decimals', () => {
    expect(clampRate(0.1, 'youtube')).toBe(0.25)
    expect(clampRate(0.1, 'local')).toBe(0.1)
    expect(clampRate(0.333, 'local')).toBe(0.33)
    expect(clampRate(5, 'local')).toBe(2)
    expect(clampRate(NaN, 'youtube')).toBe(1)
  })
  it('writes a speed with ×', () => {
    expect(formatRate(0.35)).toBe('0.35×')
    expect(formatRate(1)).toBe('1×')
  })
})

import { stepRate } from '@/lib/playbackRate'

describe('stepRate', () => {
  it('steps by a quarter, as YouTube does', () => {
    expect(stepRate(1, 1, 'youtube')).toBe(1.25)
    expect(stepRate(1, -1, 'youtube')).toBe(0.75)
    expect(stepRate(0.25, -1, 'youtube')).toBe(0.25)
    expect(stepRate(2, 1, 'youtube')).toBe(2)
  })
  it('goes one step further down on an audio file', () => {
    expect(stepRate(0.25, -1, 'local')).toBe(0.1)
  })
  it('steps a custom speed to the nearest one past it', () => {
    expect(stepRate(0.35, 1, 'youtube')).toBe(0.5)
    expect(stepRate(0.35, -1, 'youtube')).toBe(0.25)
  })
})
