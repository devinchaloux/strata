import { describe, it, expect } from 'vitest'
import { formatClock } from '@/lib/youtube'

describe('formatClock', () => {
  it('reads m:ss, whole seconds rounded down', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(68.9)).toBe('1:08')
    expect(formatClock(290)).toBe('4:50')
  })
  it('adds hours past an hour, and treats nonsense as zero', () => {
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(NaN)).toBe('0:00')
    expect(formatClock(-3)).toBe('0:00')
  })
})
