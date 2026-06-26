import { describe, it, expect } from 'vitest'
import {
  estimateTextWidth,
  truncateToWidth,
  verticalBoundaryTimes,
  sharedTimes,
  buildTailPaths,
  type SpanEdge,
} from '@/lib/formShape'

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

describe('verticalBoundaryTimes', () => {
  const flat = (startTime: number, endTime: number, extra: Partial<SpanEdge> = {}): SpanEdge => ({
    startTime,
    endTime,
    lineType: 'flat',
    ...extra,
  })

  it('returns flat + definite edges, sorted and de-duped', () => {
    const spans = [flat(0, 10), flat(10, 20), flat(20, 30)]
    expect(verticalBoundaryTimes(spans)).toEqual([0, 10, 20, 30])
  })

  it('excludes arc spans (no vertical tail)', () => {
    const spans: SpanEdge[] = [
      { startTime: 0, endTime: 10, lineType: 'arc' },
      flat(10, 20),
    ]
    expect(verticalBoundaryTimes(spans)).toEqual([10, 20])
  })

  it('excludes gradual (angled) tails', () => {
    const spans = [
      flat(0, 10, { endBoundaryType: 'gradual' }),
      flat(10, 20, { startBoundaryType: 'gradual' }),
    ]
    // start 0 (definite) and end 20 (definite) survive; the gradual edge at 10 does not.
    expect(verticalBoundaryTimes(spans)).toEqual([0, 20])
  })
})

describe('buildTailPaths', () => {
  it('returns empty tails for an arc (no vertical tails)', () => {
    const t = buildTailPaths({ width: 100, lineType: 'arc', startBoundary: 'definite', endBoundary: 'definite' })
    expect(t.left).toBe('')
    expect(t.right).toBe('')
  })

  it('returns both tails for a flat bracket', () => {
    const t = buildTailPaths({ width: 100, lineType: 'flat', startBoundary: 'definite', endBoundary: 'definite' })
    expect(t.left.length).toBeGreaterThan(0)
    expect(t.right.length).toBeGreaterThan(0)
    expect(t.left.startsWith('M')).toBe(true)
  })
})

describe('sharedTimes', () => {
  it('returns only times present in both lists', () => {
    expect(sharedTimes([0, 10, 20, 30], [10, 30])).toEqual([10, 30])
  })

  it('matches within epsilon and averages the pair', () => {
    const out = sharedTimes([10.00004], [9.99998])
    expect(out).toHaveLength(1)
    expect(out[0]).toBeCloseTo(10, 4)
  })

  it('is empty when nothing aligns', () => {
    expect(sharedTimes([1, 2, 3], [4, 5, 6])).toEqual([])
  })
})
