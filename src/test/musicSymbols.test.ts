import { describe, it, expect } from 'vitest'
import { toAccidentals } from '@/lib/musicSymbols'

describe('toAccidentals', () => {
  it('converts a leading flat before a Roman numeral', () => {
    expect(toAccidentals('bVI')).toBe('♭VI')
    expect(toAccidentals('bIII')).toBe('♭III')
    expect(toAccidentals('bvii')).toBe('♭vii')
  })

  it('converts a flat after a note letter', () => {
    expect(toAccidentals('Bb')).toBe('B♭')
    expect(toAccidentals('Eb')).toBe('E♭')
  })

  it('converts sharps anywhere', () => {
    expect(toAccidentals('F#')).toBe('F♯')
    expect(toAccidentals('#iv')).toBe('♯iv')
    expect(toAccidentals('C#m')).toBe('C♯m')
  })

  it('leaves a lone b as the note name', () => {
    expect(toAccidentals('b')).toBe('b')
  })

  it('handles double flats', () => {
    expect(toAccidentals('Bbb')).toBe('B♭♭')
  })

  it('handles applied chords', () => {
    expect(toAccidentals('V/V')).toBe('V/V')
    expect(toAccidentals('bVI/bIII')).toBe('♭VI/♭III')
    expect(toAccidentals('V/vi')).toBe('V/vi')
  })

  it('leaves plain Roman numerals untouched', () => {
    expect(toAccidentals('vi')).toBe('vi')
    expect(toAccidentals('III')).toBe('III')
    expect(toAccidentals('IV')).toBe('IV')
  })

  it('is idempotent, so re-editing an existing value is stable', () => {
    expect(toAccidentals(toAccidentals('bVI'))).toBe('♭VI')
    expect(toAccidentals('♭VI')).toBe('♭VI')
    expect(toAccidentals('F♯')).toBe('F♯')
  })

  it('passes through empty input', () => {
    expect(toAccidentals('')).toBe('')
  })
})
