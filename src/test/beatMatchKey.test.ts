import { describe, it, expect } from 'vitest'
import { beatMatchKey } from '@/store/beatMatch'

describe('beatMatchKey', () => {
  it('nudges by , and ., and further with Alt/Option by physical key', () => {
    expect(beatMatchKey({ key: ',' })).toBe('earlier')
    expect(beatMatchKey({ key: '≤', code: 'Comma', altKey: true })).toBe('earlier-coarse')
    expect(beatMatchKey({ key: '≥', code: 'Period', altKey: true })).toBe('later-coarse')
  })
  it('leaves Shift+< and Shift+> to the speed', () => {
    expect(beatMatchKey({ key: '<' })).toBeNull()
    expect(beatMatchKey({ key: '>' })).toBeNull()
  })
})
