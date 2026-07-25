import { describe, it, expect } from 'vitest'
import type { StrataDocument, Span, Layer } from '@/types/strata'

describe('StrataDocument shape', () => {
  it('accepts a minimal valid document', () => {
    const doc: StrataDocument = {
      strataVersion: '0.1.0',
      fileFormatVersion: 1,
      createdAt: '2026-06-13T00:00:00.000Z',
      updatedAt: '2026-06-13T00:00:00.000Z',
      title: 'Levels',
      artist: ['Avicii'],
      duration: 201.6,
      source: { type: 'youtube', url: 'https://www.youtube.com/watch?v=_ovdm2yX4MA', sourceOffset: 0 },
      vocabulary: { spanTypes: [], pointMarkerTypes: [], modes: [] },
      sharedTimePoints: [],
      layers: [],
      pointMarkers: [],
    }
    expect(doc.title).toBe('Levels')
    expect(doc.fileFormatVersion).toBe(1)
  })

  it('accepts a span with all optional fields null', () => {
    const span: Span = {
      id: 'abc-123',
      startTime: 0,
      endTime: 32.5,
    }
    expect(span.label).toBeUndefined()
    expect(span.type).toBeUndefined()
  })

  it('accepts a form-diagram layer', () => {
    const layer: Layer = {
      id: 'layer-1',
      type: 'form-diagram',
      label: 'Large-scale form',
      visibility: true,
      locked: false,
      fillColorDefault: '#6366f1',
      strokeColorDefault: '#6366f1',
      displayOrder: 0,
      data: { hierarchicalEnforcement: false, spans: [] },
    }
    expect(layer.type).toBe('form-diagram')
    expect(layer.data.hierarchicalEnforcement).toBe(false)
  })

  it('represents multi-artist correctly', () => {
    const artists = ['The Chainsmokers', 'Halsey']
    const doc: Partial<StrataDocument> = { artist: artists }
    expect(doc.artist).toHaveLength(2)
  })
})
