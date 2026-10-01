import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import { exportVocabPack, mergeVocabPack, readVocabPack } from '@/lib/vocabPack'
import { letterTerm } from '@/lib/vocabulary'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc } from './fixtures'

const schema = JSON.parse(readFileSync(resolve(__dirname, '../../schema/strata-vocab.schema.json'), 'utf8'))
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema)

const PACK = JSON.stringify({
  name: 'Lieder',
  version: '1.2.0',
  terms: [
    { id: 'nachspiel', label: 'Nachspiel', kind: 'span', description: 'The postlude', broader: ['outro'] },
    { id: 'vorspiel', label: 'Vorspiel', kind: 'span' },
    { id: 'Bad Id', label: 'Bad', kind: 'span' },
    { id: 'chorus', label: 'Chorus', kind: 'span' },
    { id: 'word-painting', label: 'Word painting', kind: 'point-marker' },
  ],
})

describe('reading a pack', () => {
  it('keeps the usable terms and names the rest', () => {
    const { pack, skipped } = readVocabPack(PACK)
    expect(pack.terms.map((t) => t.id)).toEqual(['nachspiel', 'vorspiel', 'chorus', 'word-painting'])
    expect(pack.terms[0].broader).toEqual(['outro'])
    expect(skipped).toHaveLength(1)
  })

  it('refuses a file that is not a pack', () => {
    expect(() => readVocabPack('not json')).toThrow(/valid JSON/)
    expect(() => readVocabPack('{"name":"x"}')).toThrow(/no list of terms/)
    expect(() => readVocabPack('{"terms":[]}')).toThrow(/no name/)
  })
})

describe('merging a pack', () => {
  const vocab = { spanTypes: [{ id: 'vorspiel', label: 'My vorspiel' }], pointMarkerTypes: [], modes: [] }

  it('adds new terms tagged with the pack, and skips built-ins and the file’s own', () => {
    const r = mergeVocabPack(vocab, readVocabPack(PACK).pack)
    expect(r.added).toBe(2)
    expect(r.vocabulary.spanTypes.find((t) => t.id === 'nachspiel')?.source).toBe('Lieder v1.2.0')
    expect(r.vocabulary.spanTypes.find((t) => t.id === 'vorspiel')?.label).toBe('My vorspiel')
    expect(r.vocabulary.pointMarkerTypes.map((t) => t.id)).toEqual(['word-painting'])
    expect(r.skipped.join(' ')).toMatch(/chorus: already built in/)
  })

  it('replaces its own earlier terms on a re-import', () => {
    const first = mergeVocabPack(vocab, readVocabPack(PACK).pack).vocabulary
    const newer = readVocabPack(PACK.replace('1.2.0', '1.3.0').replace('The postlude', 'The closing postlude')).pack
    const r = mergeVocabPack(first, newer)
    expect(r.added).toBe(0)
    expect(r.updated).toBe(2)
    expect(r.vocabulary.spanTypes.find((t) => t.id === 'nachspiel')).toMatchObject({ description: 'The closing postlude', source: 'Lieder v1.3.0' })
  })

  it('is one undo step in the store', () => {
    const store = useDocumentStore
    store.getState().loadDocument(makeDoc([]))
    store.temporal.getState().clear()
    store.getState().importVocabPack(readVocabPack(PACK).pack)
    expect(store.getState().document!.vocabulary.spanTypes).toHaveLength(2)
    store.temporal.getState().undo()
    expect(store.getState().document!.vocabulary.spanTypes).toHaveLength(0)
  })
})

describe('exporting a pack', () => {
  it('holds the file’s own types, not its letters or another pack’s terms, and fits the schema', () => {
    const doc = makeDoc([])
    doc.vocabulary.spanTypes = [
      letterTerm('A', 1),
      { id: 'my-section', label: 'My section', description: 'Mine' },
      { id: 'nachspiel', label: 'Nachspiel', source: 'Lieder v1.2.0' },
    ]
    doc.vocabulary.pointMarkerTypes = [{ id: 'energy-peak', label: 'Peak' }]
    const pack = exportVocabPack(doc)
    expect(pack.terms.map((t) => [t.id, t.kind])).toEqual([['my-section', 'span'], ['energy-peak', 'point-marker']])
    expect(validate(pack), JSON.stringify(validate.errors)).toBe(true)
    // …and reads back in.
    expect(readVocabPack(JSON.stringify(pack)).pack.terms).toHaveLength(2)
  })
})
