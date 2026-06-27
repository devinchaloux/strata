import { describe, it, expect } from 'vitest'
import {
  estimateTextWidth,
  truncateToWidth,
  verticalBoundaryTimes,
  sharedTimes,
  buildTailPaths,
  buildTopPath,
  boundaryTails,
  type SpanEdge,
  type BoundaryTailInput,
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

describe('buildTopPath', () => {
  it('returns the dome for an arc', () => {
    const d = buildTopPath({ width: 100, height: 28, lineType: 'arc', startBoundary: 'definite', endBoundary: 'definite' })
    expect(d).toBe('M 0 28 A 50 28 0 0 1 100 28')
  })

  it('omits the definite tail verticals — corners only, no drop to the baseline', () => {
    const d = buildTopPath({ width: 100, height: 28, lineType: 'flat', startBoundary: 'definite', endBoundary: 'definite' })
    // The top path must never command a line down to the baseline (y = H = 28):
    // the verticals are the shared boundary pass's job.
    expect(d).not.toContain('28')
    // It begins at the corner foot (y = r), not the baseline.
    expect(d.startsWith('M 0 6')).toBe(true) // r = CORNER_RADIUS = 6
    expect(d.split('A').length).toBe(3) // two corner arcs
  })

  it('keeps a gradual tail as a diagonal that reaches the baseline', () => {
    const d = buildTopPath({ width: 100, height: 28, lineType: 'flat', startBoundary: 'gradual', endBoundary: 'definite' })
    // The gradual (left) tail starts inset on the baseline and ramps to the top.
    expect(d.startsWith('M 9 28')).toBe(true) // GRADUAL_INSET = 9, H = 28
  })
})

describe('boundaryTails', () => {
  const flat = (
    startTime: number,
    endTime: number,
    extra: Partial<BoundaryTailInput> = {},
  ): BoundaryTailInput => ({ startTime, endTime, lineType: 'flat', ...extra })

  it('collapses a shared boundary between adjacent spans into one tail', () => {
    const tails = boundaryTails([flat(0, 10), flat(10, 20)])
    expect(tails.map((t) => t.time)).toEqual([0, 10, 20])
  })

  it('flags only the first and last tails as edges', () => {
    const tails = boundaryTails([flat(0, 10), flat(10, 20), flat(20, 30)])
    expect(tails.map((t) => t.edge)).toEqual(['start', null, null, 'end'])
  })

  it('dashes a shared boundary if EITHER neighbour is non-definite (decision b)', () => {
    const tails = boundaryTails([
      flat(0, 10, { confidence: 'definite' }),
      flat(10, 20, { confidence: 'approximate' }),
    ])
    const at10 = tails.find((t) => Math.abs(t.time - 10) < 1e-6)!
    expect(at10.dashed).toBe(true)
    // The outer (start) boundary touches only the definite span → solid.
    expect(tails.find((t) => t.time === 0)!.dashed).toBe(false)
    // The outer (end) boundary touches only the approximate span → dashed.
    expect(tails.find((t) => t.time === 20)!.dashed).toBe(true)
  })

  it('excludes arcs and gradual boundaries', () => {
    const tails = boundaryTails([
      { startTime: 0, endTime: 10, lineType: 'arc' },
      flat(10, 20, { startBoundaryType: 'gradual', endBoundaryType: 'definite' }),
    ])
    // arc contributes nothing; the gradual start at 10 is excluded; only end 20 survives.
    expect(tails.map((t) => t.time)).toEqual([20])
  })

  it('treats elided boundaries as vertical tails', () => {
    const tails = boundaryTails([flat(0, 10, { endBoundaryType: 'elided' })])
    expect(tails.map((t) => t.time)).toEqual([0, 10])
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
