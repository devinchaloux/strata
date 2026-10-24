// @vitest-environment jsdom
/**
 * Grouping spans into a span on another layer, and copying one span up.
 */
import { describe, it, expect } from 'vitest'
import { groupPreview, placeSpan, layerAbove } from '@/lib/groupSpans'
import { formSpans } from '@/lib/layers'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const times = (spans: { startTime: number; endTime: number }[]) => spans.map((s) => [s.startTime, s.endTime])
let n = 0
const mkId = () => `new-${++n}`

describe('placeSpan', () => {
  const target = [makeSpan('a', 0, 10), makeSpan('b', 10, 20), makeSpan('c', 20, 30), makeSpan('d', 30, 60)]

  it('drops into an empty stretch untouched', () => {
    expect(times(placeSpan([makeSpan('a', 0, 10)], makeSpan('g', 20, 30), mkId))).toEqual([[0, 10], [20, 30]])
  })

  it('replaces spans inside its stretch and cuts back ones across its edges', () => {
    const out = placeSpan(target, makeSpan('g', 5, 25), mkId)
    expect(out.map((s) => [s.id, s.startTime, s.endTime])).toEqual([
      ['a', 0, 5],
      ['g', 5, 25],
      ['c', 25, 30],
      ['d', 30, 60],
    ])
    expect(groupPreview(target, 5, 25)).toEqual({ replaced: 1, cut: 2 })
  })

  it('splits a span it falls inside into two pieces', () => {
    const out = placeSpan([makeSpan('big', 0, 60, { label: 'Verse', endCap: 'elision' })], makeSpan('g', 20, 30), mkId)
    expect(times(out)).toEqual([[0, 20], [20, 30], [30, 60]])
    expect(out[0]).toMatchObject({ id: 'big', label: 'Verse', endCap: undefined })
    expect(out[2]).toMatchObject({ label: 'Verse', endCap: 'elision' })
    expect(out[2].id).not.toBe('big')
  })
})

describe('layerAbove', () => {
  it('is the next layer up the stack', () => {
    const layers = [makeLayer('low', [], 0), makeLayer('top', [], 5), makeLayer('mid', [], 2)]
    expect(layerAbove(layers, layers[0])?.id).toBe('mid')
    expect(layerAbove(layers, layers[1])).toBeNull()
  })
})

describe('in the store', () => {
  const store = () => useDocumentStore.getState()
  const layer = (id: string) => store().document!.layers.find((l) => l.id === id)!

  it('groups several spans into one blank span on the chosen layer', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8, { label: 'a' }), makeSpan('p2', 8, 16), makeSpan('p3', 16, 24)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1)]))
    const id = store().groupSpans(['p1', 'p2'], { layerId: 'sections' })!
    expect(formSpans(layer('sections'))).toEqual([{ id, startTime: 0, endTime: 16 }])
    expect(formSpans(layer('phrases'))).toHaveLength(3)
  })

  it('copies one span up a layer whole, with a slug of its own', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8, { label: 'Intro', type: 'intro', slug: 'intro' })], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1)]))
    const id = store().groupIntoLayerAbove(['p1'])!
    const copy = formSpans(layer('sections'))[0]
    expect(copy).toMatchObject({ id, startTime: 0, endTime: 8, label: 'Intro', type: 'intro' })
    expect(copy.slug).not.toBe('intro')
  })

  it('won’t copy up over a span already there', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [makeSpan('s1', 0, 16, { label: 'Verse' })], 1)]))
    expect(store().groupIntoLayerAbove(['p1'])).toBeNull()
    expect(formSpans(layer('sections'))).toEqual([makeSpan('s1', 0, 16, { label: 'Verse' })])
  })

  it('makes a layer just above when there is none', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8)], 0)
    store().loadDocument(makeDoc([phrases]))
    store().groupIntoLayerAbove(['p1'])
    const layers = store().document!.layers
    expect(layers).toHaveLength(2)
    const made = layers.find((l) => l.id !== 'phrases')!
    expect(made.displayOrder).toBe(1)
    expect(formSpans(made)).toHaveLength(1)
  })

  it('refuses a locked layer or one of the spans’ own', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8)], 0)
    store().loadDocument(makeDoc([phrases, { ...makeLayer('locked', [], 1), locked: true }]))
    expect(store().groupSpans(['p1'], { layerId: 'locked' })).toBeNull()
    expect(store().groupSpans(['p1'], { layerId: 'phrases' })).toBeNull()
  })

  it('makes the new span the parent of what it groups', () => {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8), makeSpan('p2', 8, 16)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1)]))
    const id = store().groupSpans(['p1', 'p2'], { layerId: 'sections' })
    expect(formSpans(layer('phrases')).map((s) => s.parentId)).toEqual([id, id])
  })
})

describe('linked boundaries', () => {
  const store = () => useDocumentStore.getState()
  const spansOf = (id: string) => times(formSpans(store().document!.layers.find((l) => l.id === id)!))
  // Phrases of 8 s; sections grouped from them: 0–16 and 16–32.
  function load() {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8), makeSpan('p2', 8, 16), makeSpan('p3', 16, 24), makeSpan('p4', 24, 32)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1), makeLayer('top', [], 2)]))
    store().groupSpans(['p1', 'p2'], { layerId: 'sections' })
    store().groupSpans(['p3', 'p4'], { layerId: 'sections' })
  }

  it('moves a section boundary when the phrase boundary under it is dragged', () => {
    load()
    store().setAdjacentBoundary('phrases', 'p2', 'p3', 18)
    expect(spansOf('sections')).toEqual([[0, 18], [18, 32]])
  })

  it('leaves a section alone when a phrase boundary inside it moves', () => {
    load()
    store().setAdjacentBoundary('phrases', 'p1', 'p2', 9)
    expect(spansOf('sections')).toEqual([[0, 16], [16, 32]])
  })

  it('moves the phrases when the section boundary is dragged', () => {
    load()
    const [a, b] = formSpans(store().document!.layers.find((l) => l.id === 'sections')!)
    store().setAdjacentBoundary('sections', a.id, b.id, 15)
    expect(spansOf('phrases')).toEqual([[0, 8], [8, 15], [15, 24], [24, 32]])
  })

  it('carries a move through more than one level', () => {
    load()
    const secs = formSpans(store().document!.layers.find((l) => l.id === 'sections')!)
    store().groupSpans([secs[0].id], { layerId: 'top' })
    store().setAdjacentBoundary('phrases', 'p2', 'p3', 17)
    expect(spansOf('top')).toEqual([[0, 17]])
  })

  it('follows a ripple of bar lengths', () => {
    load()
    store().loadDocument({ ...store().document!, beatGrid: [{ id: 'g', start: 0, bpm: 120, beatsPerBar: 4 }] })
    // A bar is 2 s: p1 one bar longer moves every later phrase boundary, and the section edge at 16.
    store().resizeSpanByBars('phrases', 'p1', 1)
    expect(spansOf('sections')).toEqual([[0, 18], [18, 32]])
  })

  it('stops once unlinked', () => {
    load()
    store().updateSpans(['p2', 'p3'], { parentId: null })
    store().setAdjacentBoundary('phrases', 'p2', 'p3', 18)
    expect(spansOf('sections')).toEqual([[0, 16], [16, 32]])
  })
})
