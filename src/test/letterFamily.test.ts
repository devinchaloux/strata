import { describe, it, expect } from 'vitest'
import { letterFamily, familyLabels } from '@/lib/vocabulary'

describe('letterFamily', () => {
  it('reads the letter from a letter type, primes aside', () => {
    expect(letterFamily({ type: 'a-section' })).toBe('A')
    expect(letterFamily({ type: 'a-prime', label: 'Theme' })).toBe('A')
    expect(letterFamily({ type: 'b-double-prime' })).toBe('B')
  })

  it('falls back to the label', () => {
    expect(letterFamily({ label: 'A′' })).toBe('A')
    expect(letterFamily({ label: "c''" })).toBe('C')
    expect(letterFamily({ label: 'A', type: 'verse' })).toBe('A')
  })

  it('is null for a span that is not lettered', () => {
    expect(letterFamily({ label: 'Verse 1', type: 'verse' })).toBeNull()
    expect(letterFamily({ label: 'AB' })).toBeNull()
    expect(letterFamily({})).toBeNull()
  })
})

describe('familyLabels', () => {
  it('names the members plainest first, once each', () => {
    expect(familyLabels([{ label: 'A″' }, { label: 'A' }, { label: 'A′' }, { label: 'A' }])).toBe('A, A′, A″')
  })
})
