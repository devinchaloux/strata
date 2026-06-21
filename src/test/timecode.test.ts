import { describe, it, expect } from 'vitest'
import { parseTimecode } from '@/lib/timecode'

describe('parseTimecode', () => {
  it('parses bare seconds', () => {
    expect(parseTimecode('90')).toBe(90)
    expect(parseTimecode('90.5')).toBe(90.5)
    expect(parseTimecode('0')).toBe(0)
  })

  it('parses mm:ss[.mmm]', () => {
    expect(parseTimecode('1:30')).toBe(90)
    expect(parseTimecode('1:30.5')).toBe(90.5)
    expect(parseTimecode('0:30.000')).toBe(30)
    expect(parseTimecode('2:15.000')).toBe(135)
  })

  it('parses hh:mm:ss', () => {
    expect(parseTimecode('1:02:03.250')).toBe(3723.25)
  })

  it('rejects malformed input', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('1:90')).toBeNull() // seconds out of range
    expect(parseTimecode('-5')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull() // too many parts
  })
})
