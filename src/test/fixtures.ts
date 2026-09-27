/**
 * Minimal document builders shared by the store and file-format tests.
 * Deliberately bare: each test adds only the fields it is about.
 */
import type { StrataDocument, Layer, Span } from '@/types/strata'

export function makeLayer(id: string, spans: Span[] = [], displayOrder = 0): Layer {
  return {
    id,
    type: 'form-diagram',
    label: id,
    visibility: true,
    locked: false,
    fillColorDefault: '#ffffff',
    strokeColorDefault: '#475569',
    displayOrder,
    data: { hierarchicalEnforcement: false, spans },
  }
}

export function makeSpan(id: string, startTime: number, endTime: number, extra: Partial<Span> = {}): Span {
  return { id, startTime, endTime, ...extra }
}

export function makeDoc(layers: Layer[] = [], extra: Partial<StrataDocument> = {}): StrataDocument {
  return {
    strataVersion: '0.1.0',
    fileFormatVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Test',
    artist: ['Tester'],
    duration: 100,
    source: { type: 'youtube', url: 'https://youtu.be/x', sourceOffset: 0 },
    vocabulary: { spanTypes: [], pointMarkerTypes: [], modes: [] },
    sharedTimePoints: [],
    layers,
    pointMarkers: [],
    ...extra,
  }
}
