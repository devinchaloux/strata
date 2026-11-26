import { describe, it, expect } from 'vitest'
import { barNumberLabels, boundaryOnBar, countLabels, countOf, countsByGroups, elideLabels, gridBars, holdsCount, phraseRuns, splitEvenly, writeCounts } from '@/lib/hypermeter'
import { readDocument } from '@/lib/documentLoad'
import type { GridSegment, Span } from '@/types/strata'
import { segmentSpans } from '@/lib/layers'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer } from './fixtures'

// 120 bpm in 4/4: a bar is 2 seconds.
const seg = (start: number, extra: Partial<GridSegment> = {}): GridSegment => ({ id: `s${start}`, start, bpm: 120, beatsPerBar: 4, ...extra })

describe('gridBars', () => {
  it('gives one [start, end] per bar of the grid', () => {
    expect(gridBars([seg(0)], 8)).toEqual([[0, 2], [2, 4], [4, 6], [6, 8]])
  })

  it('leaves out free stretches and a last sliver under a tenth of a bar', () => {
    const bars = gridBars([seg(0, { end: 4 }), seg(10)], 14.1)
    expect(bars).toEqual([[0, 2], [2, 4], [10, 12], [12, 14]])
  })

  it('has none without a grid', () => {
    expect(gridBars([], 60)).toEqual([])
  })
})

describe('countLabels', () => {
  it('counts in groups', () => {
    expect(countLabels(6, 4)).toEqual(['1', '2', '3', '4', '1', '2'])
    expect(countLabels(4, 3)).toEqual(['1', '2', '3', '1'])
  })
})

describe('countOf', () => {
  it('reads a count, and an elided bar as what it becomes', () => {
    expect(countOf('3')).toBe(3)
    expect(countOf('4=1')).toBe(1)
    expect(countOf('Verse')).toBeNull()
    expect(countOf(null)).toBeNull()
  })
})

describe('elideLabels', () => {
  it('turns a bar into "4=1" and counts on from 2', () => {
    expect(elideLabels(['1', '2', '3', '4', '1', '2', '3'], 3, 4)).toEqual(['1', '2', '3', '4=1', '2', '3', '4'])
  })

  it('takes the count the bar would have had', () => {
    expect(elideLabels(['1', '2', '3', '1', '2'], 2, 4)).toEqual(['1', '2', '3=1', '2', '3'])
  })

  it('stops at a bar whose label is not a count', () => {
    expect(elideLabels(['1', '2', '3', '4', 'Drop', '2'], 3, 4)).toEqual(['1', '2', '3', '4=1', 'Drop', '2'])
  })
})

describe('in the store', () => {
  const store = () => useDocumentStore.getState()
  // 120 bpm 4/4 from 0: eight 2-second bars in 16 seconds.
  const load = () => {
    store().loadDocument({ ...makeDoc([makeLayer('L')]), duration: 16, beatGrid: [seg(0)] })
    return 'L'
  }
  const spansOf = (i = 0) => segmentSpans(store().document!.layers[i])
  const labels = () => spansOf().map((s) => s.label)
  const counts = (i = 0) => spansOf(i).map((s) => s.annotation)

  it('fills an empty layer with the grid\'s bars and makes it the bar layer', () => {
    const id = load()
    expect(store().numberBars(id, 4)).toBe(8)
    expect(store().document!.layers[0].role).toBe('bars')
    expect(labels()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(counts()).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
    // Not over spans that are already there.
    expect(store().numberBars(id, 4)).toBe(0)
  })

  it('takes bar numbers from the grid, which honors a first bar', () => {
    store().loadDocument({ ...makeDoc([makeLayer('L')]), duration: 8, beatGrid: [seg(0, { firstBar: 0 })] })
    store().numberBars('L', 4)
    expect(labels()).toEqual(['0', '1', '2', '3'])
  })

  it('recounts a run of selected bars from 1, in threes', () => {
    const id = load()
    store().numberBars(id, 4)
    const ids = spansOf().slice(4).map((s) => s.id)
    store().renumberSpans(id, ids, 3)
    expect(counts()).toEqual(['1', '2', '3', '4', '1', '2', '3', '1'])
  })

  it('never counts over an annotation that holds a note', () => {
    const id = load()
    store().numberBars(id, 4)
    store().updateSpan(id, spansOf()[5].id, { annotation: 'Drop' })
    store().renumberSpans(id, spansOf().map((s) => s.id), 4)
    expect(counts()).toEqual(['1', '2', '3', '4', '1', 'Drop', '3', '4'])
  })

  it('elides a bar and counts on, and one undo puts it back', () => {
    const id = load()
    store().numberBars(id, 4)
    const fourth = spansOf()[3].id
    store().elideSpan(id, fourth, 4)
    expect(counts()).toEqual(['1', '2', '3', '4=1', '2', '3', '4', '1'])
    expect(labels()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    useDocumentStore.temporal.getState().undo()
    expect(counts()).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
  })
})

describe('the bar layer', () => {
  const store = () => useDocumentStore.getState()
  const bar = (k: number, extra: Partial<Span> = {}): Span => ({ id: `b${k}`, startTime: k * 2, endTime: k * 2 + 2, ...extra })
  const phrase = (id: string, start: number, end: number, extra: Partial<Span> = {}): Span => ({ id, startTime: start, endTime: end, ...extra })
  const layerOf = (id: string) => store().document!.layers.find((l) => l.id === id)!
  const field = (id: string, f: 'label' | 'annotation') => segmentSpans(layerOf(id)).map((s) => s[f])

  // Eight bars below; above them phrases of 3 and 5 bars.
  function load(barSpans: Span[] = Array.from({ length: 8 }, (_, k) => bar(k))) {
    store().loadDocument({
      ...makeDoc([
        makeLayer('Bars', barSpans, 0),
        makeLayer('Phrases', [phrase('p1', 0, 6), phrase('p2', 6, 16)], 1),
        makeLayer('Other', [], 2),
      ]),
      duration: 16,
    })
  }

  it('turns on, numbers its bars, and is the only bar layer', () => {
    load()
    store().setBarLayer('Bars', true)
    expect(layerOf('Bars').role).toBe('bars')
    expect(field('Bars', 'label')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    store().setBarLayer('Phrases', true)
    expect(layerOf('Bars').role).toBeUndefined()
    expect(layerOf('Phrases').role).toBe('bars')
    store().setBarLayer('Phrases', false)
    expect(layerOf('Phrases').role).toBeUndefined()
  })

  it('moves counts written as labels into the annotations', () => {
    load(Array.from({ length: 8 }, (_, k) => bar(k, { label: String((k % 4) + 1) })))
    store().setBarLayer('Bars', true)
    expect(field('Bars', 'annotation')).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
    expect(field('Bars', 'label')).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  it('keeps labels that are words', () => {
    load([bar(0, { label: 'Intro' }), bar(1)])
    store().setBarLayer('Bars', true)
    expect(field('Bars', 'label')).toEqual(['Intro', undefined])
  })

  it('numbers from a pickup bar', () => {
    load()
    store().setBarLayer('Bars', true)
    store().numberBarLayer('Bars', 0)
    expect(field('Bars', 'label')).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
  })

  it('counts by the phrases above, each from 1 to its end', () => {
    load()
    expect(store().countBars('Bars', 'Phrases', 4)).toEqual({ counted: 8, skipped: 0 })
    expect(field('Bars', 'annotation')).toEqual(['1', '2', '3', '1', '2', '3', '4', '5'])
  })

  it('counts in groups, and reports the notes it left alone', () => {
    load([bar(0), bar(1, { annotation: 'Hook' }), bar(2), bar(3)])
    expect(store().countBars('Bars', null, 2)).toEqual({ counted: 3, skipped: 1 })
    expect(field('Bars', 'annotation')).toEqual(['1', 'Hook', '1', '2'])
  })

  it('elides the phrase boundary on an elided bar', () => {
    load()
    store().countBars('Bars', 'Phrases', 4)
    expect(store().elideGroupBoundary('Bars', 'b3')).toBe('Phrases')
    const [p1, p2] = segmentSpans(layerOf('Phrases'))
    expect(p1.endBoundaryType).toBe('elided')
    expect(p2.startBoundaryType).toBeUndefined() // elision is per side
    // No boundary above bar 2.
    expect(store().elideGroupBoundary('Bars', 'b1')).toBeNull()
  })

  it('loads with at most one bar layer', () => {
    const doc = makeDoc([{ ...makeLayer('A'), role: 'bars' }, { ...makeLayer('B', [], 1), role: 'bars' }])
    const { doc: read } = readDocument(JSON.parse(JSON.stringify(doc)))
    expect(read.layers.map((l) => l.role)).toEqual(['bars', undefined])
  })
})

describe('bar-layer helpers', () => {
  it('numbers bars', () => {
    expect(barNumberLabels(3)).toEqual(['1', '2', '3'])
    expect(barNumberLabels(2, 0)).toEqual(['0', '1'])
  })

  it('writes counts only over counts or nothing', () => {
    expect(holdsCount('')).toBe(true)
    expect(holdsCount('4=1')).toBe(true)
    expect(holdsCount('Hook')).toBe(false)
    expect(writeCounts(['1', 'Hook', null], ['2', '3', '4'])).toEqual(['2', 'Hook', '4'])
  })

  it('counts by groups, and in fixed groups where there is none', () => {
    const bars: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
    expect(countsByGroups(bars, [[0, 3]], 2)).toEqual(['1', '2', '3', '1', '2', '1'])
  })

  it('finds a boundary on a bar, at its start or its end', () => {
    const spans = [{ startTime: 0, endTime: 4 }, { startTime: 4, endTime: 8 }]
    expect(boundaryOnBar([4, 5], spans)).toEqual({ before: spans[0], after: spans[1] })
    expect(boundaryOnBar([3, 4], spans)).toEqual({ before: spans[0], after: spans[1] })
    expect(boundaryOnBar([1, 2], spans)).toBeNull()
  })
})

describe('bars from phrases, phrases from bars', () => {
  const store = () => useDocumentStore.getState()
  const layers = () => [...store().document!.layers].sort((a, b) => a.displayOrder - b.displayOrder)
  const byLabel = (label: string) => layers().find((l) => l.label === label)!
  const sp = (id: string, startTime: number, endTime: number, extra: Partial<Span> = {}): Span => ({ id, startTime, endTime, ...extra })

  it('splits only the selected phrases into bars, on a new bar layer below them', () => {
    // Three phrases; the analyst picks the middle two, a chunk of the track.
    store().loadDocument({ ...makeDoc([makeLayer('Phrases', [sp('p1', 0, 8), sp('p2', 8, 14), sp('p3', 14, 20)], 0)]), duration: 20 })
    const r = store().splitIntoBars(['p2', 'p3'], 3)
    expect(r).toMatchObject({ made: 6 })
    const bars = byLabel('Bars')
    expect(bars.role).toBe('bars')
    expect(layers().map((l) => l.label)).toEqual(['Bars', 'Phrases'])
    const made = segmentSpans(bars)
    expect(made.map((b) => [b.startTime, b.endTime])).toEqual([[8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20]])
    expect(made.map((b) => b.label)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(made.map((b) => b.annotation)).toEqual(['1', '2', '3', '1', '2', '3'])
    expect(made.map((b) => b.parentId)).toEqual(['p2', 'p2', 'p2', 'p3', 'p3', 'p3'])
    // The first phrase next: its bars go in, and numbering goes on from the bar before.
    store().splitIntoBars(['p1'], 4)
    expect(segmentSpans(byLabel('Bars')).map((b) => b.label).slice(0, 4)).toEqual(['1', '2', '3', '4'])
    // Not over bars that are there.
    expect(store().splitIntoBars(['p2'], 3)).toBe('occupied')
    useDocumentStore.temporal.getState().undo()
    expect(segmentSpans(byLabel('Bars'))).toHaveLength(6)
  })

  it('makes phrases from a chunk of counted bars, eliding where a bar is 4=1', () => {
    const counts = ['1', '2', '3', '4', '1', '2', '3', '4=1', '2', '3', '4']
    const bars = counts.map((c, k) => sp(`b${k}`, k * 2, k * 2 + 2, { annotation: c }))
    store().loadDocument({ ...makeDoc([{ ...makeLayer('Bars', bars, 0), role: 'bars' as const }, makeLayer('Phrases', [sp('far', 30, 40)], 1)]), duration: 40 })
    // Bars 2 onward only: the first phrase starts at the first selected bar.
    const r = store().phrasesFromCount(bars.slice(2).map((b) => b.id))
    expect(r?.layerId).toBe('Phrases')
    const phrases = segmentSpans(byLabel('Phrases')).filter((p) => p.id !== 'far')
    expect(phrases.map((p) => [p.startTime, p.endTime])).toEqual([[4, 8], [8, 14], [14, 22]])
    expect(phrases[1].endBoundaryType).toBe('elided')
    const kids = segmentSpans(byLabel('Bars')).filter((b) => b.parentId === phrases[2].id).map((b) => b.id)
    expect(kids).toEqual(['b7', 'b8', 'b9', 'b10'])
    // The layer above is now full there: a second run makes a new Phrases layer.
    store().phrasesFromCount(bars.slice(2).map((b) => b.id))
    expect(layers().map((l) => l.label)).toEqual(['Bars', 'Phrases', 'Phrases'])
  })

  it('splits evenly and finds runs', () => {
    expect(splitEvenly(0, 6, 3)).toEqual([[0, 2], [2, 4], [4, 6]])
    const runs = phraseRuns([sp('a', 0, 1, { annotation: '1' }), sp('b', 1, 2, { annotation: '2' }), sp('c', 2, 3, { annotation: '2=1' }), sp('d', 3, 4, { annotation: 'Hook' })])
    expect(runs).toEqual([
      { start: 0, end: 2, ids: ['a', 'b'], elided: false },
      { start: 2, end: 4, ids: ['c', 'd'], elided: true },
    ])
  })
})

describe('numbering and counting a selection', () => {
  const store = () => useDocumentStore.getState()
  const bars = Array.from({ length: 6 }, (_, k): Span => ({ id: `b${k}`, startTime: k * 2, endTime: k * 2 + 2 }))
  const layer = () => store().document!.layers[0]

  it('numbers and counts only the selected bars', () => {
    store().loadDocument({ ...makeDoc([{ ...makeLayer('Bars', bars), role: 'bars' as const }]), duration: 12 })
    store().numberBarLayer('Bars', 10, ['b2', 'b3', 'b4'])
    expect(segmentSpans(layer()).map((s) => s.label ?? null)).toEqual([null, null, '10', '11', '12', null])
    expect(store().countBars('Bars', null, 2, ['b2', 'b3', 'b4'])).toEqual({ counted: 3, skipped: 0 })
    expect(segmentSpans(layer()).map((s) => s.annotation ?? null)).toEqual([null, null, '1', '2', '1', null])
  })
})
