import { formSpans } from '@/lib/layers'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDocument, DocumentError, SUPPORTED_FILE_FORMAT_VERSION } from '@/lib/documentLoad'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '../../schema', name), 'utf8')) as Record<string, unknown>

describe('readDocument — identifying a file', () => {
  it('refuses something that is not a Strata document', () => {
    expect(() => readDocument([])).toThrow(DocumentError)
    expect(() => readDocument({ title: 'x' })).toThrow('missing required fields')
  })

  it('reads both bundled fixtures without notices', () => {
    for (const name of ['alive.strata', 'example.strata']) {
      const { notices } = readDocument(fixture(name))
      expect(notices).toEqual([])
    }
  })
})

describe('readDocument — older and hand-written files', () => {
  it('fills in vocabulary.modes for a file written before modes existed', () => {
    const old = fixture('alive.strata')
    delete (old.vocabulary as Record<string, unknown>).modes
    const { doc } = readDocument(old)
    expect(doc.vocabulary.modes).toEqual([])
  })

  it('fills every collection the app assumes, for a bare-minimum file', () => {
    const bare = {
      strataVersion: '0.1.0',
      fileFormatVersion: 1,
      title: 'Bare',
      layers: [{ id: 'x', type: 'form-diagram', label: 'L' }],
    }
    const { doc } = readDocument(bare)
    expect(doc.vocabulary).toEqual({ spanTypes: [], pointMarkerTypes: [], modes: [] })
    expect(doc.pointMarkers).toEqual([])
    expect(doc.sharedTimePoints).toEqual([])
    expect(doc.artist).toEqual([])
    expect(doc.source.sourceOffset).toBe(0)
    expect(formSpans(doc.layers[0])).toEqual([])
    expect(doc.layers[0].visibility).toBe(true)
  })

  it('takes the duration from the spans when the file has none', () => {
    const input = makeDoc([makeLayer('L', [makeSpan('a', 0, 42)])], { duration: 0 })
    expect(readDocument(input).doc.duration).toBe(42)
  })

  it('sorts spans by start time', () => {
    const input = makeDoc([makeLayer('L', [makeSpan('b', 50, 100), makeSpan('a', 0, 50)])])
    expect(formSpans(readDocument(input).doc.layers[0]).map((s) => s.id)).toEqual(['a', 'b'])
  })
})

describe('readDocument — problems', () => {
  it('names the span whose times are broken', () => {
    const input = makeDoc([makeLayer('Sections', [makeSpan('a', 10, 5)])])
    expect(() => readDocument(input)).toThrow('"Sections", span 1 ends')
  })

  it('refuses two spans that share an id', () => {
    const input = makeDoc([makeLayer('L', [makeSpan('a', 0, 5), makeSpan('a', 5, 10)])])
    expect(() => readDocument(input)).toThrow('reuses the id')
  })

  it('opens a layer with overlapping spans, with a notice', () => {
    const input = makeDoc([makeLayer('Phrases', [makeSpan('a', 0, 60), makeSpan('b', 50, 100)])])
    const { doc, notices } = readDocument(input)
    expect(formSpans(doc.layers[0])).toHaveLength(2)
    expect(notices[0]).toContain('"Phrases" has two spans that overlap')
  })

  it('keeps a layer of an unknown widget type unchanged, with a notice', () => {
    const contour = { id: 'e', type: 'energy-contour', label: 'Energy', data: { points: [1, 2] } }
    const input = { ...makeDoc(), layers: [contour] }
    const { doc, notices } = readDocument(input)
    expect(doc.layers[0]).toMatchObject(contour)
    expect(notices[0]).toContain("can't display yet")
  })

  it('warns about a file from a newer format version', () => {
    const input = makeDoc([], { fileFormatVersion: SUPPORTED_FILE_FORMAT_VERSION + 1 })
    expect(readDocument(input).notices[0]).toContain('newer version of Strata')
  })
})

describe('readDocument — slugs', () => {
  it('fills missing slugs for labelled spans, unique in time order, keeping existing ones', () => {
    const input = makeDoc([
      makeLayer('L', [
        makeSpan('a', 0, 10, { label: 'Verse' }),
        makeSpan('b', 10, 20, { label: 'Chorus', slug: 'hook' }),
        makeSpan('c', 20, 30, { label: 'Verse' }),
        makeSpan('d', 30, 40),
      ]),
    ])
    const spans = formSpans(readDocument(input).doc.layers[0])
    expect(spans.map((s) => s.slug)).toEqual(['verse', 'hook', 'verse-2', undefined])
  })
})
