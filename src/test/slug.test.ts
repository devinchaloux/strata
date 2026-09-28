import { formSpans } from '@/lib/layers'
import { describe, it, expect, beforeEach } from 'vitest'
import { slugify, uniqueSlug } from '@/lib/slug'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

describe('slugify', () => {
  it('kebab-cases a label', () => {
    expect(slugify('Drop 1')).toBe('drop-1')
    expect(slugify('  Beat-match intro ')).toBe('beat-match-intro')
    expect(slugify('!!!')).toBeNull()
  })

  it('spells out primes so A and A′ stay distinct', () => {
    expect(slugify('A')).toBe('a')
    expect(slugify("A'")).toBe('a-prime')
    expect(slugify('A′')).toBe('a-prime')
    expect(slugify("A''")).toBe('a-double-prime')
    expect(slugify('A″')).toBe('a-double-prime')
    expect(slugify("B' section")).toBe('b-prime-section')
  })

  it('treats an apostrophe inside a word as punctuation', () => {
    expect(slugify("Don't Stop")).toBe('dont-stop')
  })
})

describe('uniqueSlug', () => {
  it('suffixes -2, -3 … past what is taken', () => {
    expect(uniqueSlug('verse', new Set())).toBe('verse')
    expect(uniqueSlug('verse', new Set(['verse', 'verse-2']))).toBe('verse-3')
  })
})

describe('slugs in the store', () => {
  const store = () => useDocumentStore.getState()
  const spans = () => store().document!.layers.flatMap((l) => formSpans(l))
  const slugOf = (id: string) => spans().find((s) => s.id === id)?.slug

  beforeEach(() => {
    // A fresh, never-saved document: nothing is frozen yet.
    store().loadDocument(
      makeDoc([makeLayer('L', [makeSpan('a', 0, 30), makeSpan('b', 30, 60), makeSpan('c', 60, 100)])]),
    )
  })

  it('follows the label while the document is unsaved', () => {
    store().setSpanLabels(['a'], 'Drop')
    store().setSpanLabels(['a'], 'Drop 1')
    expect(slugOf('a')).toBe('drop-1')
  })

  it('freezes on save, so a rename keeps the slug an embed may use', () => {
    store().setSpanLabels(['a'], 'Drop')
    store().markSaved()
    store().setSpanLabels(['a'], 'Big Drop')
    expect(slugOf('a')).toBe('drop')
    store().regenerateSlug('a')
    expect(slugOf('a')).toBe('big-drop')
  })

  it('treats slugs in an opened file as frozen', () => {
    store().loadDocument(makeDoc([makeLayer('L', [makeSpan('a', 0, 50, { label: 'Intro', slug: 'intro' })])]))
    store().setSpanLabels(['a'], 'Opening')
    expect(slugOf('a')).toBe('intro')
  })

  it('keeps slugs unique across the document, in time order', () => {
    store().setSpanLabels(['c', 'a', 'b'], 'Verse')
    expect(['a', 'b', 'c'].map(slugOf)).toEqual(['verse', 'verse-2', 'verse-3'])
  })

  it('gives the new half of a split its own slug', () => {
    store().setSpanLabels(['a'], 'Drop')
    store().placeBoundary('L', 15)
    const drops = spans().filter((s) => s.label === 'Drop')
    expect(drops.map((s) => s.slug)).toEqual(['drop', 'drop-2'])
    expect(slugOf('a')).toBe('drop') // the original span keeps its slug
  })

  it('carries a source slug into a merge that keeps its label', () => {
    store().setSpanLabels(['a'], 'Drop')
    store().mergeSpans('L', ['a', 'b'], { id: 'm', startTime: 0, endTime: 60, label: 'Drop', slug: 'drop' })
    expect(slugOf('m')).toBe('drop')
  })
})

describe('marker slugs', () => {
  const store = () => useDocumentStore.getState()
  const marker = (id: string) => store().document!.pointMarkers.find((m) => m.id === id)

  beforeEach(() => {
    store().loadDocument(makeDoc([makeLayer('L', [makeSpan('a', 0, 30, { label: 'MC', slug: 'mc' })])]))
  })

  it('share one namespace with span slugs', () => {
    store().addPointMarker({ id: 'm1', timestamp: 10, label: 'MC' })
    expect(marker('m1')?.slug).toBe('mc-2')
  })

  it('follow the label until saved, then stay', () => {
    store().addPointMarker({ id: 'm1', timestamp: 10 })
    store().updatePointMarker('m1', { label: 'PAC' })
    expect(marker('m1')?.slug).toBe('pac')
    store().markSaved()
    store().updatePointMarker('m1', { label: 'Final PAC' })
    expect(marker('m1')?.slug).toBe('pac')
  })

  it('keep span labels from taking a marker slug', () => {
    // A span with no saved slug, so its slug follows the new label.
    store().loadDocument(makeDoc([makeLayer('L', [makeSpan('a', 0, 30)])]))
    store().addPointMarker({ id: 'm1', timestamp: 10, label: 'Drop' })
    store().setSpanLabels(['a'], 'Drop')
    expect(store().document!.layers.flatMap((l) => formSpans(l))[0].slug).toBe('drop-2')
  })
})
