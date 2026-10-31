// @vitest-environment jsdom
/**
 * Grouping spans into a span on another layer, copying one span to another
 * layer, and keeping parent links sound when spans go.
 */
import { describe, it, expect } from 'vitest'
import { groupPreview, placeSpan, layerAbove } from '@/lib/groupSpans'
import { formSpans } from '@/lib/layers'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'
import { resolveMerge } from '@/lib/mergeSpans'

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

describe('copy to layer', () => {
  const store = () => useDocumentStore.getState()
  const layer = (id: string) => store().document!.layers.find((l) => l.id === id)!
  const span = (layerId: string, id: string) => formSpans(layer(layerId)).find((s) => s.id === id)!

  it('makes the copy the parent when it goes up', () => {
    store().loadDocument(makeDoc([makeLayer('phrases', [makeSpan('p1', 0, 8)], 0), makeLayer('sections', [], 1)]))
    const id = store().groupSpans(['p1'], { layerId: 'sections' })!
    expect(span('phrases', 'p1').parentId).toBe(id)
    expect(span('sections', id).parentId).toBeUndefined()
  })

  it('makes the original the parent when it goes down', () => {
    store().loadDocument(makeDoc([makeLayer('phrases', [], 0), makeLayer('sections', [makeSpan('s1', 0, 16, { label: 'Verse' })], 1)]))
    const id = store().groupSpans(['s1'], { layerId: 'phrases' })!
    expect(span('phrases', id)).toMatchObject({ label: 'Verse', parentId: 's1' })
    expect(span('sections', 's1').parentId).toBeUndefined()
  })

  it('makes a new layer just below, under the source', () => {
    store().loadDocument(makeDoc([makeLayer('sections', [makeSpan('s1', 0, 16)], 0), makeLayer('top', [], 1)]))
    const id = store().groupSpans(['s1'], { newLayer: 'Phrases', below: true })!
    const made = store().document!.layers.find((l) => l.label === 'Phrases')!
    expect(made.displayOrder).toBe(0)
    expect(layer('sections').displayOrder).toBe(1)
    expect(layer('top').displayOrder).toBe(2)
    expect(formSpans(made)[0]).toMatchObject({ id, parentId: 's1' })
  })

  it('doesn’t carry a merge record onto the copy', () => {
    store().loadDocument(makeDoc([makeLayer('phrases', [makeSpan('m', 0, 8, { mergedFrom: ['x', 'y'] })], 0), makeLayer('sections', [], 1)]))
    const id = store().groupSpans(['m'], { layerId: 'sections' })!
    expect(span('sections', id).mergedFrom).toBeUndefined()
    expect(span('phrases', 'm').mergedFrom).toEqual(['x', 'y'])
  })

  it('links the boundaries of a copy made down', () => {
    store().loadDocument(makeDoc([makeLayer('phrases', [], 0), makeLayer('sections', [makeSpan('s1', 0, 16), makeSpan('s2', 16, 32)], 1)]))
    store().groupSpans(['s1'], { layerId: 'phrases' })
    store().setAdjacentBoundary('sections', 's1', 's2', 14)
    expect(times(formSpans(layer('phrases')))).toEqual([[0, 14]])
  })
})

describe('parent links when a parent goes', () => {
  const store = () => useDocumentStore.getState()
  const parents = () => formSpans(store().document!.layers.find((l) => l.id === 'phrases')!).map((s) => s.parentId ?? null)
  // Phrases p1–p4 grouped two by two into sections s1 (0–16) and s2 (16–32).
  function load() {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8), makeSpan('p2', 8, 16), makeSpan('p3', 16, 24), makeSpan('p4', 24, 32)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1)]))
    const s1 = store().groupSpans(['p1', 'p2'], { layerId: 'sections' })!
    const s2 = store().groupSpans(['p3', 'p4'], { layerId: 'sections' })!
    return { s1, s2 }
  }

  it('hands the children of merged parents to the merged span', () => {
    const { s1, s2 } = load()
    const sections = formSpans(store().document!.layers.find((l) => l.id === 'sections')!)
    const { draft } = resolveMerge(sections, () => 'merged')
    store().mergeSpans('sections', [s1, s2], draft)
    expect(parents()).toEqual(['merged', 'merged', 'merged', 'merged'])
  })

  it('unlinks the children of a deleted parent', () => {
    const { s1, s2 } = load()
    store().removeSpan('sections', s1)
    expect(parents()).toEqual([null, null, s2, s2])
  })

  it('unlinks the children when the parents’ layer is deleted', () => {
    load()
    store().removeLayer('sections')
    expect(parents()).toEqual([null, null, null, null])
  })

  it('unlinks the children of a parent that To end removes', () => {
    const { s1 } = load()
    store().loadDocument({ ...store().document!, duration: 40 })
    store().extendToEnd('sections', s1)
    expect(parents()).toEqual([s1, s1, null, null])
  })
})

describe('splitting a parent', () => {
  const store = () => useDocumentStore.getState()
  const spansOf = (id: string) => formSpans(store().document!.layers.find((l) => l.id === id)!)
  // Phrases of 8 s, p1–p4, grouped into one section 0–32.
  function load() {
    const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8), makeSpan('p2', 8, 16), makeSpan('p3', 16, 24), makeSpan('p4', 24, 32)], 0)
    store().loadDocument(makeDoc([phrases, makeLayer('sections', [], 1)]))
    return store().groupSpans(['p1', 'p2', 'p3', 'p4'], { layerId: 'sections' })!
  }

  it('gives each child to the half it lies under', () => {
    const s = load()
    store().placeBoundary('sections', 16)
    const [left, right] = spansOf('sections')
    expect(left.id).toBe(s)
    expect(spansOf('phrases').map((p) => p.parentId)).toEqual([s, s, right.id, right.id])
  })

  it('moves a split near a phrase boundary onto it', () => {
    load()
    store().placeBoundary('sections', 16.4)
    expect(times(spansOf('sections'))).toEqual([[0, 16], [16, 32]])
  })

  it('leaves a split well inside a phrase where it is, the phrase going with the larger part', () => {
    const s = load()
    store().placeBoundary('sections', 18)
    const [, right] = spansOf('sections')
    expect(times(spansOf('sections'))).toEqual([[0, 18], [18, 32]])
    // p3 (16–24) has 2 s in the left half and 6 s in the right.
    expect(spansOf('phrases').map((p) => p.parentId)).toEqual([s, s, right.id, right.id])
  })

  it('doesn’t snap a span with no children', () => {
    store().loadDocument(makeDoc([makeLayer('phrases', [makeSpan('p1', 0, 8)], 0), makeLayer('other', [makeSpan('x', 0, 4), makeSpan('y', 4, 8)], 1)]))
    store().placeBoundary('phrases', 4.3)
    expect(times(spansOf('phrases'))).toEqual([[0, 4.3], [4.3, 8]])
  })

  it('relinks the children of a span that Group cuts in two', () => {
    // Copying p2 (8–16) up lands inside the section 0–32 and cuts it in two.
    const s = load()
    store().groupSpans(['p2'], { layerId: 'sections' })
    const [left, middle, right] = spansOf('sections')
    expect([left.id, times([left, middle, right])]).toEqual([s, [[0, 8], [8, 16], [16, 32]]])
    expect(spansOf('phrases').map((p) => p.parentId)).toEqual([s, middle.id, right.id, right.id])
  })
})
