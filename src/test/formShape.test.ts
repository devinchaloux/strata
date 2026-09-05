import { describe, it, expect } from 'vitest'
import {
  estimateTextWidth,
  truncateToWidth,
  buildShapePath,
  capFromBoundaryType,
  lineStyleDash,
  ELISION_EXTEND,
  layoutLayerLabels,
  edgeAwareJustification,
  layerBodyHeight,
  layerPitch,
  stackHeight,
  shapeTopY,
  layerIndexAtY,
  type SpanLabelInput,
  CORNER_RADIUS,
  SHAPE_HEIGHT,
  BAR_HEIGHT,
  LAYER_GAP,
  STACK_TOP_PAD,
} from '@/lib/formShape'
import type { Layer } from '@/types/strata'

function makeLayer(spanShape?: 'bracket' | 'bar'): Layer {
  return {
    id: `layer-${spanShape ?? 'bracket'}-${Math.random()}`,
    type: 'form-diagram',
    label: 'L',
    visibility: true,
    locked: false,
    fillColorDefault: '#ffffff',
    strokeColorDefault: '#475569',
    displayOrder: 0,
    spanShape,
    data: { hierarchicalEnforcement: false, spans: [] },
  }
}

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

  it('hides the label (with a marker flag) rather than truncating it, when neither label nor shortLabel fits', () => {
    // Middle span is only 40px wide; a long label has no shortLabel to fall
    // back to, so it renders nothing — never an algorithmic ellipsis stub.
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 300, label: 'A' },
      { id: 'b', x: 300, width: 40, label: 'A very long beat-matched intro label here' },
      { id: 'c', x: 340, width: 300, label: 'C' },
    ]
    const out = layoutLayerLabels(spans, FONT, 640, 'center')
    const b = out.get('b')!
    expect(b.text).toBe('')
    expect(b.hidden).toBe(true)
  })

  it('falls back to a whole shortLabel when the full label does not fit', () => {
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 300, label: 'A' },
      {
        id: 'b',
        x: 300,
        width: 40,
        label: 'A very long beat-matched intro label here',
        shortLabel: 'BMI',
      },
      { id: 'c', x: 340, width: 300, label: 'C' },
    ]
    const out = layoutLayerLabels(spans, FONT, 640, 'center')
    const b = out.get('b')!
    expect(b.text).toBe('BMI')
    expect(b.hidden).toBe(false)
  })

  it('does not flag hidden for a span with no label at all', () => {
    const spans: SpanLabelInput[] = [{ id: 'a', x: 0, width: 10, label: '' }]
    const out = layoutLayerLabels(spans, FONT, 10, 'center')
    expect(out.get('a')!.text).toBe('')
    expect(out.get('a')!.hidden).toBe(false)
  })

  it('keeps adjacent centered labels from overlapping (gutter clearance)', () => {
    // Two narrow neighbours whose full labels don't fit, but whose shortLabels
    // do — both show, and their extents must stay apart (the core collision
    // guarantee still holds for shortLabel fallbacks).
    const spans: SpanLabelInput[] = [
      { id: 'a', x: 0, width: 300, label: 'A' },
      { id: 'b', x: 300, width: 44, label: 'Buildup section one', shortLabel: 'Bu1' },
      { id: 'c', x: 344, width: 44, label: 'Buildup section two', shortLabel: 'Bu2' },
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
    expect(out.get('b')!.text).toBe('Bu1')
    expect(out.get('c')!.text).toBe('Bu2')
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

describe('elision cap — displaced outward past the boundary', () => {
  it('pushes the end tail PAST the span edge, not inset within it', () => {
    const plain = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'rounded', inset: 1.5 })
    const elided = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'elision', inset: 1.5 })
    // rounded ends at width - inset = 98.5; elision ends ELISION_EXTEND beyond it.
    expect(plain).toContain('98.5')
    expect(elided).toContain(`${100 - 1.5 + ELISION_EXTEND}`)
  })

  it('pushes the start tail leftward, into the previous span', () => {
    const elided = buildShapePath({ width: 100, startCap: 'elision', endCap: 'rounded', inset: 1.5 })
    expect(elided).toContain(`M ${1.5 - ELISION_EXTEND} `)
  })

  it('draws the same rounded corner as a rounded cap — only the x differs', () => {
    const rounded = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'rounded' })
    const elided = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'elision' })
    // Same command sequence (M/L/A/…), so the shape vocabulary is unchanged.
    expect(elided.replace(/[\d.-]+/g, '#')).toBe(rounded.replace(/[\d.-]+/g, '#'))
  })

  it('is per-boundary — an unelided cap on the same span is untouched', () => {
    const elided = buildShapePath({ width: 100, startCap: 'rounded', endCap: 'elision', inset: 1.5 })
    expect(elided).toContain('M 1.5 ')
  })

  it('clamps the extension to half the span width, so a narrow span cannot overshoot', () => {
    // width 10 → half is 5, below the fixed 8px signal.
    const narrow = buildShapePath({ width: 10, startCap: 'rounded', endCap: 'elision', inset: 1.5 })
    expect(narrow).toContain(`${10 - 1.5 + 5}`)
    expect(narrow).not.toContain(`${10 - 1.5 + ELISION_EXTEND}`)
  })

  it('leaves the extension at full strength once the span is wide enough', () => {
    // width 16 → half is 8, exactly the fixed signal; anything wider stays at 8.
    const wide = buildShapePath({ width: 40, startCap: 'rounded', endCap: 'elision', inset: 1.5 })
    expect(wide).toContain(`${40 - 1.5 + ELISION_EXTEND}`)
  })
})

describe('layer stacking with variable (bracket vs. bar) heights', () => {
  it('layerBodyHeight resolves bracket (default) vs. bar', () => {
    expect(layerBodyHeight(makeLayer())).toBe(SHAPE_HEIGHT)
    expect(layerBodyHeight(makeLayer('bracket'))).toBe(SHAPE_HEIGHT)
    expect(layerBodyHeight(makeLayer('bar'))).toBe(BAR_HEIGHT)
  })

  it('layerPitch adds the hairline gap to the body height', () => {
    expect(layerPitch(makeLayer())).toBe(SHAPE_HEIGHT + LAYER_GAP)
    expect(layerPitch(makeLayer('bar'))).toBe(BAR_HEIGHT + LAYER_GAP)
  })

  it('stackHeight sums each layer\'s own pitch, not a uniform one', () => {
    const layers = [makeLayer(), makeLayer('bar'), makeLayer()]
    const expected = STACK_TOP_PAD + 2 * (SHAPE_HEIGHT + LAYER_GAP) + (BAR_HEIGHT + LAYER_GAP)
    expect(stackHeight(layers)).toBe(expected)
  })

  it('shapeTopY accumulates preceding layers\' actual pitches', () => {
    const layers = [makeLayer('bar'), makeLayer(), makeLayer('bar')]
    expect(shapeTopY(layers, 0)).toBe(STACK_TOP_PAD)
    expect(shapeTopY(layers, 1)).toBe(STACK_TOP_PAD + (BAR_HEIGHT + LAYER_GAP))
    expect(shapeTopY(layers, 2)).toBe(
      STACK_TOP_PAD + (BAR_HEIGHT + LAYER_GAP) + (SHAPE_HEIGHT + LAYER_GAP),
    )
  })

  it('layerIndexAtY finds the band a y-coordinate falls in', () => {
    const layers = [makeLayer('bar'), makeLayer(), makeLayer('bar')]
    // Row 0 spans [STACK_TOP_PAD, STACK_TOP_PAD + BAR_HEIGHT + LAYER_GAP)
    expect(layerIndexAtY(layers, STACK_TOP_PAD + 1)).toBe(0)
    // Row 1 (bracket) starts right after row 0's pitch
    expect(layerIndexAtY(layers, STACK_TOP_PAD + BAR_HEIGHT + LAYER_GAP + 1)).toBe(1)
    // Far past the end clamps to the last row
    expect(layerIndexAtY(layers, 10_000)).toBe(2)
  })

  it('layerIndexAtY returns 0 for an empty layer list', () => {
    expect(layerIndexAtY([], 500)).toBe(0)
  })
})
