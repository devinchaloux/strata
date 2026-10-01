import { describe, it, expect } from 'vitest'
import {
  BUILT_IN_SPAN_TERMS,
  BUILT_IN_POINT_MARKER_TERMS,
  LIBRARIES,
  ancestorsOf,
  builtInTerm,
  findTerm,
  letterTerm,
  parseLetter,
  searchTerms,
  typesUnder,
} from '@/lib/vocabulary'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc } from './fixtures'

const ALL = [...BUILT_IN_SPAN_TERMS, ...BUILT_IN_POINT_MARKER_TERMS]

describe('the built-in vocabulary', () => {
  it('has unique ids that fit the VocabTerm pattern', () => {
    const ids = ALL.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('lists every term in a library, and only terms of the right kind', () => {
    const listed = new Set(LIBRARIES.flatMap((l) => [...l.spanTypes, ...l.pointMarkerTypes]))
    for (const t of ALL) expect(listed.has(t.id), t.id).toBe(true)
    for (const l of LIBRARIES) {
      for (const id of l.spanTypes) expect(builtInTerm(id)?.kind, `${l.id}: ${id}`).toBe('span')
      for (const id of l.pointMarkerTypes) expect(builtInTerm(id)?.kind, `${l.id}: ${id}`).toBe('point-marker')
    }
  })

  it('links broader terms that exist, of the same kind', () => {
    for (const t of ALL)
      for (const b of t.broader ?? []) expect(builtInTerm(b)?.kind, `${t.id} → ${b}`).toBe(t.kind)
  })

  it('keeps the point-marker ids that files already use', () => {
    for (const id of ['perfect-authentic-cadence', 'half-cadence', 'medial-caesura', 'key-change', 'note'])
      expect(builtInTerm(id)?.kind).toBe('point-marker')
  })
})

describe('roll-up across frameworks', () => {
  it('finds every framework’s transition under "transition"', () => {
    const under = typesUnder('transition')
    expect(under).toEqual(new Set(['transition', 'caplin-transition', 'hd-tr-zone']))
    expect(ancestorsOf('caplin-transition')).toEqual(['transition'])
  })

  it('follows a file’s own terms, and ignores a cycle', () => {
    const custom = [
      { id: 'my-tr', label: 'My TR', broader: ['caplin-transition'] },
      { id: 'loop-a', label: 'A', broader: ['loop-b'] },
      { id: 'loop-b', label: 'B', broader: ['loop-a'] },
    ]
    expect(typesUnder('transition', custom).has('my-tr')).toBe(true)
    expect(ancestorsOf('my-tr', custom)).toEqual(['caplin-transition', 'transition'])
    expect(ancestorsOf('loop-a', custom)).toEqual(['loop-b'])
  })
})

describe('letters', () => {
  it('make the same ids every time', () => {
    expect(letterTerm('A', 0)).toMatchObject({ id: 'a-section', label: 'A' })
    expect(letterTerm('b', 1)).toMatchObject({ id: 'b-prime', label: 'B′' })
    expect(letterTerm('C', 2)).toMatchObject({ id: 'c-double-prime', label: 'C″' })
  })

  it('read from typed text', () => {
    expect(parseLetter("b'")).toEqual({ letter: 'B', primes: 1 })
    expect(parseLetter('A″')).toEqual({ letter: 'A', primes: 2 })
    expect(parseLetter('a')).toEqual({ letter: 'A', primes: 0 })
    expect(parseLetter('ab')).toBeNull()
  })
})

describe('search', () => {
  it('puts exact and prefix matches first, and reaches packs', () => {
    const hits = searchTerms('transition', 'span', [])
    expect(hits[0].term.id).toBe('transition')
    expect(hits.map((h) => h.term.id)).toContain('caplin-transition')
    expect(searchTerms('caplin', 'span', []).every((h) => h.term.id.startsWith('caplin-') || /caplin/i.test(h.term.definition ?? ''))).toBe(true)
  })

  it('includes the file’s own terms', () => {
    const hits = searchTerms('verse', 'span', [{ id: 'my-verse', label: 'My verse' }])
    expect(hits.some((h) => h.term.id === 'my-verse' && h.term.custom)).toBe(true)
  })
})

describe('the file’s own terms', () => {
  it('are added once, and resolve after built-ins', () => {
    const store = () => useDocumentStore.getState()
    store().loadDocument(makeDoc([]))
    store().addVocabTerm('spanTypes', letterTerm('A', 1))
    store().addVocabTerm('spanTypes', letterTerm('A', 1))
    const custom = store().document!.vocabulary.spanTypes
    expect(custom.map((t) => t.id)).toEqual(['a-prime'])
    expect(findTerm('a-prime', 'span', custom)?.label).toBe('A′')
    expect(findTerm('chorus', 'span', custom)?.label).toBe('Chorus')
    expect(findTerm('chorus', 'point-marker', custom)).toBeUndefined()
  })
})
