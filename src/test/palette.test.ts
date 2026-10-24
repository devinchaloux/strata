/**
 * Every palette colour gets legible text on it: the label and annotation inks
 * where they reach 4.5:1 (WCAG AA), a deeper ink or white where they don't.
 */
import { describe, it, expect } from 'vitest'
import { PALETTE, QUICK_FILLS, SAFE_FILLS, safeFill } from '@/lib/palette'
import { contrast, textOnFill } from '@/lib/formShape'

const LABEL_INK = '#334155'
const ANNOTATION_INK = '#475569'

describe('text on palette fills', () => {
  const fills = [...PALETTE.flatMap((p) => [p.muted, p.deep, p.bright]), ...SAFE_FILLS]

  it.each(fills)('%s reads at 4.5:1 or better', (fill) => {
    expect(contrast(fill, textOnFill(fill, LABEL_INK))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(fill, textOnFill(fill, ANNOTATION_INK))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the ink on the muted fills Quick pick offers', () => {
    for (const fill of QUICK_FILLS) expect(textOnFill(fill, LABEL_INK)).toBe(LABEL_INK)
  })

  it('measures the editor’s ink variable as the ink it stands for', () => {
    expect(textOnFill('#94b4dc', 'var(--ink-primary)')).toBe('var(--ink-primary)')
  })

  it('turns white on a deep fill', () => {
    expect(textOnFill('#1e40af', LABEL_INK)).toBe('#ffffff')
  })
})

describe('colour-blind safe', () => {
  it('draws each quick fill as its safe counterpart, slot for slot', () => {
    expect(QUICK_FILLS.map(safeFill)).toEqual(SAFE_FILLS)
  })

  it('leaves any other colour as it is, in any case', () => {
    expect(safeFill('#1e40af')).toBe('#1e40af')
    expect(safeFill(QUICK_FILLS[0].toUpperCase())).toBe(SAFE_FILLS[0])
  })

  it('has a quick fill per hue, all different', () => {
    expect(new Set(QUICK_FILLS).size).toBe(8)
    expect(new Set(SAFE_FILLS).size).toBe(8)
  })
})
