import { describe, it, expect } from 'vitest'
import { quickTypes, typeSuggestions } from '@/lib/typeSuggestions'
import { letterTerm } from '@/lib/vocabulary'
import { applySpanType } from '@/store/typeActions'
import { useDocumentStore } from '@/store/documentStore'
import { formSpans } from '@/lib/layers'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const sections = makeLayer('S', [
  makeSpan('s1', 0, 10, { type: 'intro', label: 'Intro' }),
  makeSpan('s2', 10, 30, { type: 'verse', label: 'Verse' }),
  makeSpan('s3', 30, 40, { type: 'chorus', label: 'Chorus' }),
  makeSpan('s4', 40, 60),
])
const phrases = makeLayer('P', [
  makeSpan('p1', 10, 20, { type: 'a-section', label: 'A' }),
  makeSpan('p2', 20, 30, { type: 'b-section', label: 'B' }),
  makeSpan('p3', 30, 40),
])
const doc = () => makeDoc([sections, phrases], { vocabulary: { spanTypes: [letterTerm('A', 0), letterTerm('B', 0)], pointMarkerTypes: [], modes: [] } })

describe('type suggestions', () => {
  it('lead with the level’s own types in order, then its library', () => {
    const s = typeSuggestions(doc(), 'span', 'S')
    expect(s.inLayer.map((t) => t.id)).toEqual(['intro', 'verse', 'chorus'])
    expect(s.suggested?.lib.id).toBe('pop-rock')
    expect(s.nextLetter).toBe('C')
  })

  it('give a lettered level its letters and the next one', () => {
    expect(quickTypes(doc(), 'P').map((o) => [o.term.label, !!o.isNew])).toEqual([['A', false], ['B', false], ['C', true]])
  })

  it('give other levels their types, then suggestions, up to the limit', () => {
    const q = quickTypes(doc(), 'S', 5).map((o) => o.term.id)
    expect(q.slice(0, 3)).toEqual(['intro', 'verse', 'chorus'])
    expect(q).toHaveLength(5)
  })
})

describe('applySpanType', () => {
  it('adds a new letter, types the spans and lets labels follow, in one undo step', () => {
    const store = useDocumentStore
    store.getState().loadDocument(doc())
    store.temporal.getState().clear()
    const c = letterTerm('C', 0)
    applySpanType(['p3'], { ...c, kind: 'span' }, c)
    const p3 = formSpans(store.getState().document!.layers[1]).find((s) => s.id === 'p3')!
    expect([p3.type, p3.label]).toEqual(['c-section', 'C'])
    expect(store.getState().document!.vocabulary.spanTypes.map((t) => t.id)).toContain('c-section')
    store.temporal.getState().undo()
    expect(store.getState().document!.vocabulary.spanTypes.map((t) => t.id)).not.toContain('c-section')
  })
})
