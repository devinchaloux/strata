import { describe, it, expect } from 'vitest'
import { countLabels, countOf, elideLabels, gridBars } from '@/lib/hypermeter'
import type { GridSegment } from '@/types/strata'
import { formSpans } from '@/lib/layers'
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
  const labels = () => formSpans(store().document!.layers[0]).map((s) => s.label)

  it('numbers an empty layer, one span per bar', () => {
    const id = load()
    expect(store().numberBars(id, 4)).toBe(8)
    expect(labels()).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
    // Not over spans that are already there.
    expect(store().numberBars(id, 4)).toBe(0)
  })

  it('recounts a run of selected bars from 1, in threes', () => {
    const id = load()
    store().numberBars(id, 4)
    const ids = formSpans(store().document!.layers[0]).slice(4).map((s) => s.id)
    store().renumberSpans(id, ids, 3)
    expect(labels()).toEqual(['1', '2', '3', '4', '1', '2', '3', '1'])
  })

  it('elides a bar and counts on, and one undo puts it back', () => {
    const id = load()
    store().numberBars(id, 4)
    const fourth = formSpans(store().document!.layers[0])[3].id
    store().elideSpan(id, fourth, 4)
    expect(labels()).toEqual(['1', '2', '3', '4=1', '2', '3', '4', '1'])
    useDocumentStore.temporal.getState().undo()
    expect(labels()).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
  })
})
