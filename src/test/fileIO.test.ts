import { describe, it, expect } from 'vitest'
import { parseStrataFile, createEmptyDocument } from '@/lib/fileIO'
import type { StrataDocument } from '@/types/strata'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMinimalDoc(): StrataDocument {
  const iso = '2026-06-13T00:00:00.000Z'
  return {
    strataVersion: '0.1.0',
    fileFormatVersion: 1,
    createdAt: iso,
    updatedAt: iso,
    title: 'Levels',
    artist: ['Avicii'],
    duration: 201.6,
    source: { type: 'youtube', url: 'https://www.youtube.com/watch?v=_ovdm2yX4MA', sourceOffset: 0 },
    vocabulary: { spanTypes: [], pointMarkerTypes: [], modes: [] },
    sharedTimePoints: [],
    layers: [],
    pointMarkers: [],
  }
}

// ---------------------------------------------------------------------------
// parseStrataFile
// ---------------------------------------------------------------------------

describe('parseStrataFile', () => {
  it('parses a valid document', () => {
    const doc = makeMinimalDoc()
    const parsed = parseStrataFile(JSON.stringify(doc))
    expect(parsed.title).toBe('Levels')
    expect(parsed.fileFormatVersion).toBe(1)
    expect(parsed.artist).toEqual(['Avicii'])
  })

  it('throws on non-JSON input', () => {
    expect(() => parseStrataFile('not json')).toThrow('not valid JSON')
  })

  it('throws on a JSON array', () => {
    expect(() => parseStrataFile('[]')).toThrow('not a valid .strata document')
  })

  it('throws when required fields are missing', () => {
    const broken = { title: 'Hi', layers: [] }
    expect(() => parseStrataFile(JSON.stringify(broken))).toThrow('missing required fields')
  })

  it('throws when layers is not an array', () => {
    const broken = { strataVersion: '0.1.0', fileFormatVersion: 1, title: 'Hi', layers: 'nope' }
    expect(() => parseStrataFile(JSON.stringify(broken))).toThrow('missing required fields')
  })
})

// ---------------------------------------------------------------------------
// Roundtrip
// ---------------------------------------------------------------------------

describe('JSON roundtrip', () => {
  it('survives serialize → parse for a minimal document', () => {
    const doc = makeMinimalDoc()
    const serialized = JSON.stringify(doc, null, 2)
    const parsed = parseStrataFile(serialized)
    expect(parsed).toEqual(doc)
  })

  it('survives roundtrip with spans and point markers', () => {
    const doc = makeMinimalDoc()
    doc.layers = [
      {
        id: 'layer-1',
        type: 'form-diagram',
        label: 'Large-scale form',
        visibility: true,
        locked: false,
        fillColorDefault: '#6366f1',
        strokeColorDefault: '#6366f1',
        displayOrder: 0,
        data: {
          hierarchicalEnforcement: false,
          spans: [
            {
              id: 'span-1',
              startTime: 0,
              endTime: 32.5,
              label: 'Intro',
              slug: 'intro',
              type: 'intro',
            },
          ],
        },
      },
    ]
    doc.pointMarkers = [
      { id: 'pm-1', timestamp: 16.0, label: 'Midpoint', flagged: true },
    ]
    const parsed = parseStrataFile(JSON.stringify(doc, null, 2))
    expect(parsed.layers[0].data.spans[0].label).toBe('Intro')
    expect(parsed.pointMarkers[0].flagged).toBe(true)
    expect(parsed).toEqual(doc)
  })
})

// ---------------------------------------------------------------------------
// createEmptyDocument
// ---------------------------------------------------------------------------

describe('createEmptyDocument', () => {
  it('produces a structurally valid document', () => {
    const doc = createEmptyDocument()
    expect(doc.title).toBe('Untitled Analysis')
    expect(doc.layers).toEqual([])
    expect(doc.fileFormatVersion).toBe(1)
    expect(doc.strataVersion).toBe('0.1.0')
  })

  it('is parseable after serialization', () => {
    const doc = createEmptyDocument()
    const parsed = parseStrataFile(JSON.stringify(doc))
    expect(parsed.title).toBe(doc.title)
  })
})
