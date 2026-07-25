import { describe, it, expect } from 'vitest'
import {
  BUILT_IN_POINT_MARKER_TYPES,
  findPointMarkerType,
  formatMarkerCaption,
  pickerLabel,
} from '@/lib/pointMarkerTypes'
import type { VocabTerm } from '@/types/strata'

const custom: VocabTerm[] = [
  { id: 'energy-peak', label: 'Energy Peak', description: 'Maximum perceived energy' },
  { id: 'bare-term', label: 'Bare' },
]

describe('built-in point marker types', () => {
  it('ids are unique', () => {
    const ids = BUILT_IN_POINT_MARKER_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids match the VocabTerm.id constraint', () => {
    for (const t of BUILT_IN_POINT_MARKER_TYPES) {
      expect(t.id).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it('covers the cadence set', () => {
    const labels = BUILT_IN_POINT_MARKER_TYPES.map((t) => t.label)
    expect(labels).toEqual(expect.arrayContaining(['PAC', 'IAC', 'HC', 'DC', 'EC', 'PHC', 'PC']))
  })
})

describe('findPointMarkerType', () => {
  it('resolves a built-in', () => {
    expect(findPointMarkerType('half-cadence', [])?.label).toBe('HC')
  })

  it('resolves a document custom type', () => {
    expect(findPointMarkerType('energy-peak', custom)?.label).toBe('Energy Peak')
  })

  it('returns undefined for null, undefined, and unknown ids', () => {
    expect(findPointMarkerType(null, custom)).toBeUndefined()
    expect(findPointMarkerType(undefined, custom)).toBeUndefined()
    expect(findPointMarkerType('not-a-type', custom)).toBeUndefined()
  })

  it('prefers the built-in when a custom type shadows its id', () => {
    const shadow: VocabTerm[] = [{ id: 'half-cadence', label: 'Shadowed' }]
    expect(findPointMarkerType('half-cadence', shadow)?.label).toBe('HC')
  })
})

describe('pickerLabel', () => {
  it('combines description and abbreviation', () => {
    expect(pickerLabel({ id: 'half-cadence', label: 'HC', description: 'Half cadence' })).toBe(
      'Half cadence (HC)',
    )
  })

  it('falls back to the label alone when there is no description', () => {
    expect(pickerLabel({ id: 'bare-term', label: 'Bare' })).toBe('Bare')
  })
})

describe('formatMarkerCaption', () => {
  it('joins key and type as V:PAC', () => {
    expect(
      formatMarkerCaption({ type: 'perfect-authentic-cadence', harmonicContext: 'V' }, []),
    ).toBe('V:PAC')
  })

  it('renders the type alone when there is no key', () => {
    expect(formatMarkerCaption({ type: 'half-cadence', harmonicContext: null }, [])).toBe('HC')
  })

  it('renders the key alone when there is no type', () => {
    expect(formatMarkerCaption({ type: null, harmonicContext: 'bVI' }, [])).toBe('bVI')
  })

  it('returns null when neither is set', () => {
    expect(formatMarkerCaption({ type: null, harmonicContext: null }, [])).toBeNull()
  })

  it('treats a whitespace-only key as absent', () => {
    expect(formatMarkerCaption({ type: 'half-cadence', harmonicContext: '   ' }, [])).toBe('HC')
    expect(formatMarkerCaption({ type: null, harmonicContext: '   ' }, [])).toBeNull()
  })

  it('trims a key with surrounding whitespace', () => {
    expect(formatMarkerCaption({ type: 'half-cadence', harmonicContext: ' V ' }, [])).toBe('V:HC')
  })

  it('uses a custom type label', () => {
    expect(formatMarkerCaption({ type: 'energy-peak', harmonicContext: null }, custom)).toBe(
      'Energy Peak',
    )
  })

  it('falls back to the raw id for an unknown type so data is never hidden', () => {
    expect(formatMarkerCaption({ type: 'mystery-type', harmonicContext: 'i' }, [])).toBe(
      'i:mystery-type',
    )
  })
})
