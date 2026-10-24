// @vitest-environment jsdom
/**
 * Fill patterns: their marks, their colour (a darker shade of the fill), and
 * that a patterned span draws its pattern in an export, under the outline.
 */
import { describe, it, expect } from 'vitest'
import { FILL_PATTERNS, patternInk, patternMarks } from '@/lib/patterns'
import { exportFormDiagramSvg } from '@/widgets/form-diagram/exportSvg'
import { safeFill, QUICK_FILLS } from '@/lib/palette'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

describe('patterns', () => {
  it('has marks for each pattern and none for anything else', () => {
    for (const p of FILL_PATTERNS) expect(patternMarks(p.id)).not.toBeNull()
    expect(patternMarks(undefined)).toBeNull()
    expect(patternMarks('plaid')).toBeNull()
    expect(patternMarks('dots')!.dots).toBe(true)
  })

  it('draws in a darker shade of the fill, or faint ink on no colour', () => {
    expect(patternInk('#a0a0a0')).toBe('#606060')
    expect(patternInk('#ffffff')).toBe('#94a3b8')
    expect(patternInk('none')).toBe('#94a3b8')
  })
})

describe('a patterned span in an export', () => {
  const doc = makeDoc([makeLayer('L', [makeSpan('s1', 0, 50, { fillColor: QUICK_FILLS[0], fillPattern: 'hatch' }), makeSpan('s2', 50, 100)])])
  const opts = { start: 0, end: 100, width: 800, includeMarkers: false, includeAxis: false }

  it('defines its pattern and fills with it', async () => {
    const svg = await exportFormDiagramSvg(doc, opts)
    expect(svg).toContain('<pattern id="fill-pattern-s1"')
    expect(svg).toContain('fill="url(#fill-pattern-s1)"')
    expect(svg.match(/<pattern /g)).toHaveLength(1)
  })

  it('takes its colour from the fill as drawn, colour-blind safe included', async () => {
    const svg = await exportFormDiagramSvg(doc, { ...opts, colorblindSafe: true })
    expect(svg).toContain(`stroke="${patternInk(safeFill(QUICK_FILLS[0]))}"`)
  })
})
