import { describe, it, expect } from 'vitest'
import {
  estimateTextWidth,
  truncateToWidth,
  buildShapePath,
  capFromBoundaryType,
  lineStyleDash,
  elisionInnerLine,
  layoutLayerLabels,
  edgeAwareJustification,
  type SpanLabelInput,
  CORNER_RADIUS,
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

  it('returns empty string when only a single-char stub would survive (not useful)', () => {
    // Width fits "D…" but not "Dr…" — stub is suppressed in favour of nothing.
    const ellipsisW = estimateTextWidth('…', 11)
    const oneCharW = estimateTextWidth('D', 11)
    const twoCharW = estimateTextWidth('Dr', 11)
    const max = oneCharW + ellipsisW + 0.5 // fits "D…" but not "Dr…"
    if (max < twoCharW + ellipsisW) {
      expect(truncateToWidth('Drop', 11, max)).toBe('')
    }
  })

  it('single-letter labels return the full label when they fit', () => {
    const labelW = estimateTextWidth('A', 11)
    expect(truncateToWidth('A', 11, labelW + 4)).toBe('A')
    expect(truncateToWidth("A'", 11, estimateTextWidth("A'", 11) + 4)).toBe("A'")
  })

  it('is empty for empty input', () => {
    expect(truncateToWidth('', 11, 100)).toBe('')
  })

  it('does not leave a trailing space before the ellipsis', () => {
    const text = 'A section'
    const max = estimateTextWidth('A ', 11) + estimateTextWidth('…', 11) + 0.01
    const out = truncateToWidth(text, 11, max)
    expect(out).not.toMatch(/ …$/)
  })
})

describe('capFromBoundaryType', () => {
  it('maps boundary character to a default visual cap', () => {
    expect(capFromBoundaryType('definite')).toBe('rounded')
    expect(capFromBoundaryType('gradual')).toBe('angled')
    expect(capFromBoundaryType('elided')).toBe('elision')
  })

  it('defaults to rounded for null/undefined', () => {
    expect(capFromBoundaryType(null)).toBe('rounded')
    expect(capFromBoundaryType(undefined)).toBe('rounded')
  })
})

describe('lineStyleDash', () => {
  it('dashes only for "dashed"', () => {
    expect(lineStyleDash('dashed')).toBe('4 3')
    expect(lineStyleDash('solid')).toBeUndefined()
    expect(lineStyleDash(undefined)).toBeUndefined()
  })
})

describe('buildShapePath', () => {
  it('draws a flat top — never a dome (no elliptical arc spanning the width)', () => {
    const d = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'rounded' })
    // A dome would be a single big A from baseline to baseline; a bracket has a
    // flat top segment at y=0.
    expect(d).toContain(' 0') // top line at y=0
    expect(d).not.toContain('A 50') // no half-width elliptical dome
  })

  it('insets the drawn shape so adjacent spans read as islands', () => {
    const flush = buildShapePath({ width: 100, startCap: 'square', endCap: 'square', inset: 0 })
    const inset = buildShapePath({ width: 100, startCap: 'square', endCap: 'square', inset: 2 })
    // Flush square starts its left tail at x=0; inset starts at x=2 and ends at 98.
    expect(flush).toContain('M 0 28')
    expect(inset).toContain('M 2 28')
    expect(inset).toContain('98')
  })

  it('square caps are sharp verticals (no corner arc)', () => {
    const d = buildShapePath({ width: 100, startCap: 'square', endCap: 'square' })
    expect(d).not.toContain('A') // no rounded corners
  })

  it('rounded caps use corner arcs at the radius', () => {
    const d = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'rounded' })
    expect(d.split('A').length).toBe(3) // two corner arcs
    expect(d).toContain(`L 0 ${CORNER_RADIUS}`) // vertical stops at the corner foot
  })

  it('an open cap omits that tail (top simply ends)', () => {
    const d = buildShapePath({ width: 100, startCap: 'open', endCap: 'square' })
    // Open start: path begins at the top-left (y=0), not the baseline.
    expect(d.startsWith('M 0 0')).toBe(true)
  })

  it('an angled start cap leans like "/" (bottom at the boundary, up to the right)', () => {
    const d = buildShapePath({ width: 100, startCap: 'angled', endCap: 'square' })
    expect(d.startsWith('M 0 28 L 9 0')).toBe(true) // ANGLE_INSET = 9, H = 28
  })

  it('an angled end cap leans like "\\" (top to the left, down to the boundary)', () => {
    const d = buildShapePath({ width: 100, startCap: 'square', endCap: 'angled' })
    expect(d).toContain('L 91 0') // top ends at R - ANGLE_INSET = 100 - 9
    expect(d.trimEnd().endsWith('L 100 28')).toBe(true) // diagonal down to the boundary
  })

  it('returns empty when the inset slot collapses', () => {
    expect(buildShapePath({ width: 3, startCap: 'square', endCap: 'square', inset: 2 })).toBe('')
  })
})

describe('layoutLayerLabels', () => {
  const FONT = 11

  it('leaves labels whole when each span has room for its own', () => {
    // Three equal wide spans, short labels → no collision pressure.
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 200, label: 'Intro' },
      { id: 'b', x: 200, width: 200, label: 'Drop' },
      { id: 'c', x: 400, width: 200, label: 'Outro' },
    ]
    const out = layoutLayerLabels(spans, FONT, 600, 'center')
    expect(out.get('a')!.text).toBe('Intro')
    expect(out.get('b')!.text).toBe('Drop')
    expect(out.get('c')!.text).toBe('Outro')
    expect(out.get('b')!.justification).toBe('center')
  })

  it('truncates the label on a narrow span squeezed between wide neighbours', () => {
    // Middle span is only 40px wide; its budget comes from the midpoints to the
    // wide neighbours' centers, but a long enough label still overruns it.
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 300, label: 'A' },
      { id: 'b', x: 300, width: 40, label: 'A very long beat-matched intro label here' },
      { id: 'c', x: 340, width: 300, label: 'C' },
    ]
    const out = layoutLayerLabels(spans, FONT, 640, 'center')
    // Lane for b: leftBound 235, rightBound 405, center 320 → availW = 170.
    const availW = 170
    const b = out.get('b')!
    expect(b.text.endsWith('…')).toBe(true)
    expect(estimateTextWidth(b.text, FONT)).toBeLessThanOrEqual(availW)
  })

  it('keeps adjacent centered labels from overlapping (gutter clearance)', () => {
    // Two narrow neighbours with long labels: both truncate, and their estimated
    // rendered extents must stay apart — the core collision guarantee.
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 300, label: 'A' },
      { id: 'b', x: 300, width: 44, label: 'Buildup section one' },
      { id: 'c', x: 344, width: 44, label: 'Buildup section two' },
      { id: 'd', x: 388, width: 300, label: 'D' },
    ]
    const out = layoutLayerLabels(spans, FONT, 688, 'center')
    const ext = (id: string, x: number, w: number) => {
      const t = out.get(id)!.text
      const half = estimateTextWidth(t, FONT) / 2
      const center = x + w / 2
      return { left: center - half, right: center + half }
    }
    const b = ext('b', 300, 44)
    const c = ext('c', 344, 44)
    // Right edge of b sits left of the left edge of c — no overlap.
    expect(b.right).toBeLessThanOrEqual(c.left)
  })

  it('re-anchors a long first-span label to the left edge instead of gutting it', () => {
    // Centered, the long label would overhang the track start (x<0); edge-aware
    // logic flips it to left-justified, which has the whole rest of the track.
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 60, label: 'Beat-match intro' },
      { id: 'b', x: 60, width: 540, label: 'Main' },
    ]
    const out = layoutLayerLabels(spans, FONT, 600, 'center')
    expect(out.get('a')!.justification).toBe('left')
    expect(out.get('a')!.text).toBe('Beat-match intro') // left lane is roomy → whole
  })

  it('yields empty text for an empty label', () => {
    const out = layoutLayerLabels([{ id: 'a', x: 0, width: 100, label: '' }], FONT, 100, 'center')
    expect(out.get('a')!.text).toBe('')
  })

  it('is order-independent (neighbours come from on-screen x, not array order)', () => {
    const spans: SpanLabelInput[] = [
      { id: 'c', x: 400, width: 200, label: 'Outro' },
      { id: 'a', x: 0, width: 200, label: 'Intro' },
      { id: 'b', x: 200, width: 200, label: 'Drop' },
    ]
    const out = layoutLayerLabels(spans, FONT, 600, 'center')
    expect(out.get('b')!.text).toBe('Drop')
    expect(out.size).toBe(3)
  })
})

describe('edgeAwareJustification', () => {
  it('keeps an interior label centered', () => {
    expect(edgeAwareJustification('center', 40, 300, 100, 600)).toBe('center')
  })

  it('left-anchors a label overhanging the track start', () => {
    expect(edgeAwareJustification('center', 120, 0, 60, 600)).toBe('left')
  })

  it('right-anchors a label overhanging the track end', () => {
    expect(edgeAwareJustification('center', 120, 560, 40, 600)).toBe('right')
  })
})

describe('elisionInnerLine', () => {
  it('returns a faint inner line only for elision caps', () => {
    expect(elisionInnerLine('rounded', 'start', 100)).toBeNull()
    expect(elisionInnerLine('elision', 'start', 100)).not.toBeNull()
  })

  it('places the start line near the left and the end line near the right', () => {
    const start = elisionInnerLine('elision', 'start', 100, 28, 0)!
    const end = elisionInnerLine('elision', 'end', 100, 28, 0)!
    expect(start).toContain('M 3 28')
    expect(end).toContain('M 97 28')
  })
})
