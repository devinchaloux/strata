import { describe, it, expect } from 'vitest'
import { layerFonts } from '@/lib/formShape'
import type { Layer } from '@/types/strata'
import { makeLayer } from './fixtures'

describe('layerFonts', () => {
  it('reads the layer text size, defaulting to md', () => {
    const layer = makeLayer('L', [])
    expect(layerFonts(layer)).toEqual({ label: 11, annotation: 9 })
    expect(layerFonts({ ...layer, fontScale: 'lg' })).toEqual({ label: 13, annotation: 11 })
    expect(layerFonts({ ...layer, fontScale: 'sm' })).toEqual({ label: 9.5, annotation: 8.5 })
  })

  it('treats an unrecognised value from a file as md', () => {
    const odd = { ...makeLayer('L', []), fontScale: 'huge' } as unknown as Layer
    expect(layerFonts(odd)).toEqual({ label: 11, annotation: 9 })
  })
})
