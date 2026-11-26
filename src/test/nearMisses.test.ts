/**
 * Near misses and lining up (lib/nearMisses.ts; docs/decisions.md, "Shared
 * Moments Move Together"): a boundary close to another layer's line but not
 * on it, and moving it onto the line.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { nearMisses, NEAR_MISS_SEC } from '@/lib/nearMisses'
import { useDocumentStore } from '@/store/documentStore'
import { segmentSpans } from '@/lib/layers'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

// Bars of 2 s, 0–16; phrases over them, their inner boundary left 0.285 s
// late at 8.285 (as after re-tapping the bars on another device); a section
// over the phrases, sharing that late boundary.
function doc() {
  const bars = makeLayer('bars', Array.from({ length: 8 }, (_, k) => makeSpan(`b${k}`, k * 2, k * 2 + 2)), 0)
  const phrases = makeLayer('phrases', [makeSpan('p1', 0, 8.285), makeSpan('p2', 8.285, 16)], 1)
  const sections = makeLayer('sections', [makeSpan('s1', 0, 8.285), makeSpan('s2', 8.285, 16)], 2)
  return makeDoc([bars, phrases, sections])
}
const store = () => useDocumentStore.getState()
const times = (id: string) => segmentSpans(store().document!.layers.find((l) => l.id === id)!).map((s) => [s.startTime, s.endTime])

describe('nearMisses', () => {
  it('finds a boundary near a finer layer’s line, on the coarser layer', () => {
    const misses = nearMisses(doc())
    expect(misses).toContainEqual({ layerId: 'phrases', time: 8.285, ontoLayerId: 'bars', ontoTime: 8 })
    // Sections and phrases share 8.285 exactly, so that pair isn't a miss; sections are off the bars too.
    expect(misses.find((m) => m.layerId === 'sections' && m.ontoLayerId === 'phrases')).toBeUndefined()
  })

  it('ignores a boundary on a line, and one further than half a second', () => {
    const d = doc()
    const far = makeDoc([d.layers[0], makeLayer('phrases', [makeSpan('p1', 0, 9), makeSpan('p2', 9, 16)], 1)])
    expect(nearMisses(far)).toEqual([])
    expect(NEAR_MISS_SEC).toBe(0.5)
  })

  it('offers nothing on a locked layer', () => {
    const d = doc()
    d.layers[1] = { ...d.layers[1], locked: true }
    expect(nearMisses(d).some((m) => m.layerId === 'phrases')).toBe(false)
  })
})

describe('in the store', () => {
  beforeEach(() => store().loadDocument(doc()))

  it('moves one boundary onto the line, and the boundary sharing it above', () => {
    expect(store().moveBoundaryTo('phrases', 8.285, 8)).toBe(1)
    expect(times('phrases')).toEqual([[0, 8], [8, 16]])
    expect(times('sections')).toEqual([[0, 8], [8, 16]])
    expect(nearMisses(store().document!)).toEqual([])
  })

  it('lines up a whole layer with another, in one step', () => {
    expect(store().lineUpWith('phrases', 'bars')).toBe(1)
    expect(times('phrases')).toEqual([[0, 8], [8, 16]])
  })

  it('moves nothing that would collapse a span', () => {
    expect(store().moveBoundaryTo('phrases', 8.285, 16)).toBe(0)
    expect(times('phrases')).toEqual([[0, 8.285], [8.285, 16]])
  })
})
