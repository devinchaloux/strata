import { describe, it, expect } from 'vitest'
import { layerHeaderWidth } from '@/lib/layerHeader'

// A stub measure: 7px a character, so the arithmetic reads plainly.
const measure = (s: string) => s.length * 7

describe('layerHeaderWidth', () => {
  it('fits the longest name, with the row’s other parts beside it', () => {
    // "Subphrases" is 70px; reading adds 17 + 6.
    expect(layerHeaderWidth(['Rotations', 'Subphrases', 'Phrases'], measure, 'reading')).toBe(93)
    // Editing adds the grip, the hide and settings buttons: 68 + 6.
    expect(layerHeaderWidth(['Rotations', 'Subphrases'], measure, 'editing')).toBe(70 + 68 + 6)
  })

  it('never goes below a column’s width, nor lets one long name take the diagram', () => {
    expect(layerHeaderWidth(['A', 'B'], measure, 'reading')).toBe(64)
    expect(layerHeaderWidth([], measure, 'editing')).toBe(112)
    expect(layerHeaderWidth(['A very long layer name that goes on and on'], measure, 'reading')).toBe(220)
  })
})
