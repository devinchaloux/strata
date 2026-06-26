import { describe, it, expect } from 'vitest'
import { estimateTextWidth, truncateToWidth } from '@/lib/formShape'

describe('estimateTextWidth', () => {
  it('scales with length and font size', () => {
    const a = estimateTextWidth('abcd', 10)
    const b = estimateTextWidth('abcdabcd', 10)
    const c = estimateTextWidth('abcd', 20)
    expect(b).toBeCloseTo(a * 2)
    expect(c).toBeCloseTo(a * 2)
  })

  it('is zero for empty text', () => {
    expect(estimateTextWidth('', 12)).toBe(0)
  })
})

describe('truncateToWidth', () => {
  it('returns the text unchanged when it already fits', () => {
    const text = 'Chorus'
    const wide = estimateTextWidth(text, 11) + 10
    expect(truncateToWidth(text, 11, wide)).toBe(text)
  })

  it('truncates with an ellipsis when too wide, and the result fits', () => {
    const text = 'Chorus Buildup'
    const max = estimateTextWidth(text, 11) / 2
    const out = truncateToWidth(text, 11, max)
    expect(out.endsWith('…')).toBe(true)
    expect(out.length).toBeLessThan(text.length)
    expect(estimateTextWidth(out, 11)).toBeLessThanOrEqual(max)
  })

  it('returns empty string when not even one char + ellipsis fits', () => {
    expect(truncateToWidth('Drop', 11, 2)).toBe('')
    expect(truncateToWidth('Drop', 11, 0)).toBe('')
  })

  it('is empty for empty input', () => {
    expect(truncateToWidth('', 11, 100)).toBe('')
  })

  it('does not leave a trailing space before the ellipsis', () => {
    // "A " would otherwise become "A …"; the space is trimmed first.
    const text = 'A section'
    const max = estimateTextWidth('A ', 11) + estimateTextWidth('…', 11) + 0.01
    const out = truncateToWidth(text, 11, max)
    expect(out).not.toMatch(/ …$/)
  })
})
