import { describe, it, expect } from 'vitest'
import {
  mergeEligibility,
  resolveMerge,
  finalizeMerge,
  NOTE_SEPARATOR,
} from '@/lib/mergeSpans'
import type { Span } from '@/types/strata'

let idCounter = 0
const mkId = () => `merged-${++idCounter}`

function span(id: string, startTime: number, endTime: number, extra: Partial<Span> = {}): Span {
  return { id, startTime, endTime, ...extra }
}

// A layer of four consecutive spans for eligibility tests.
const A = span('a', 0, 10)
const B = span('b', 10, 20)
const C = span('c', 20, 30)
const D = span('d', 30, 40)
const LAYER = [A, B, C, D]

function eligibility(selectedIds: string[], spansByLayer: Record<string, Span[]> = { L1: LAYER }) {
  const layerOf = (id: string): string | undefined => {
    for (const [lid, spans] of Object.entries(spansByLayer)) {
      if (spans.some((s) => s.id === id)) return lid
    }
    return undefined
  }
  const layerSpans = (lid: string) => spansByLayer[lid] ?? []
  return mergeEligibility(selectedIds, layerOf, layerSpans)
}

describe('mergeEligibility', () => {
  it('rejects a selection of fewer than two spans', () => {
    expect(eligibility(['a']).ok).toBe(false)
    expect(eligibility([]).ok).toBe(false)
  })

  it('accepts two or more consecutive spans in one layer', () => {
    const r = eligibility(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.layerId).toBe('L1')
      expect(r.spans.map((s) => s.id)).toEqual(['a', 'b', 'c']) // returned in startTime order
    }
  })

  it('returns spans sorted by startTime regardless of selection order', () => {
    const r = eligibility(['c', 'a', 'b'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.spans.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects a non-consecutive selection (gap in the middle)', () => {
    const r = eligibility(['a', 'c']) // b sits between them, unselected
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/consecutive/i)
  })

  it('rejects a cross-layer selection', () => {
    const spansByLayer = { L1: [A, B], L2: [span('x', 0, 10), span('y', 10, 20)] }
    const r = eligibility(['a', 'x'], spansByLayer)
    expect(r.ok).toBe(false)
  })

  it('accepts all spans in a layer', () => {
    const r = eligibility(['a', 'b', 'c', 'd'])
    expect(r.ok).toBe(true)
  })
})

describe('resolveMerge — geometry & additive fields', () => {
  it('spans the full time range and records mergedFrom in startTime order', () => {
    const { draft } = resolveMerge([B, A, C], mkId) // unsorted input
    expect(draft.startTime).toBe(0)
    expect(draft.endTime).toBe(30)
    expect(draft.mergedFrom).toEqual(['a', 'b', 'c'])
  })

  it('concatenates notes and lyrics with the separator, dropping empties', () => {
    const s1 = span('a', 0, 10, { notes: 'first', lyrics: 'la la' })
    const s2 = span('b', 10, 20, { notes: 'second', lyrics: null })
    const { draft } = resolveMerge([s1, s2], mkId)
    expect(draft.notes).toBe(`first${NOTE_SEPARATOR}second`)
    expect(draft.lyrics).toBe('la la')
  })

  it('takes the lowest confidence and omits it when all are definite', () => {
    const allDefinite = resolveMerge(
      [span('a', 0, 10), span('b', 10, 20, { confidence: 'definite' })],
      mkId,
    )
    expect(allDefinite.draft.confidence).toBeUndefined()

    const mixed = resolveMerge(
      [
        span('a', 0, 10, { confidence: 'approximate' }),
        span('b', 10, 20, { confidence: 'speculative' }),
        span('c', 20, 30, { confidence: 'definite' }),
      ],
      mkId,
    )
    expect(mixed.draft.confidence).toBe('speculative')
  })

  it('takes boundary types from the outer faces and lineType from the first span', () => {
    const s1 = span('a', 0, 10, { startBoundaryType: 'gradual', endBoundaryType: 'definite', lineType: 'flat' })
    const s2 = span('b', 10, 20, { startBoundaryType: 'definite', endBoundaryType: 'elided', lineType: 'arc' })
    const { draft } = resolveMerge([s1, s2], mkId)
    expect(draft.startBoundaryType).toBe('gradual') // first span's start
    expect(draft.endBoundaryType).toBe('elided') // last span's end
    expect(draft.lineType).toBe('flat') // first span's
  })
})

describe('resolveMerge — conflict detection', () => {
  it('reports no conflicts and a clean draft when fields agree or are lone', () => {
    const s1 = span('a', 0, 10, { label: 'Verse', type: 'verse' })
    const s2 = span('b', 10, 20, { label: null, type: 'verse' }) // label lone → take it
    const { draft, conflicts } = resolveMerge([s1, s2], mkId)
    expect(conflicts).toHaveLength(0)
    expect(draft.label).toBe('Verse')
    expect(draft.slug).toBe('verse')
    expect(draft.type).toBe('verse')
  })

  it('flags competing labels and types as conflicts', () => {
    const s1 = span('a', 0, 10, { label: 'Verse', type: 'verse' })
    const s2 = span('b', 10, 20, { label: 'Verse 1', type: 'pre-chorus' })
    const { conflicts } = resolveMerge([s1, s2], mkId)
    const byField = Object.fromEntries(conflicts.map((c) => [c.field, c.options]))
    expect(byField.label).toEqual(['Verse', 'Verse 1'])
    expect(byField.type).toEqual(['verse', 'pre-chorus'])
  })

  it('treats a lone color override as the winner, not a conflict', () => {
    const s1 = span('a', 0, 10, { fillColor: '#ff0000' })
    const s2 = span('b', 10, 20, { fillColor: null })
    const { draft, conflicts } = resolveMerge([s1, s2], mkId)
    expect(conflicts.find((c) => c.field === 'fillColor')).toBeUndefined()
    expect(draft.fillColor).toBe('#ff0000')
  })

  it('flags competing color overrides and offers layer-default when a null is present', () => {
    const s1 = span('a', 0, 10, { fillColor: '#ff0000' })
    const s2 = span('b', 10, 20, { fillColor: '#00ff00' })
    const s3 = span('c', 20, 30, { fillColor: null })
    const { conflicts } = resolveMerge([s1, s2, s3], mkId)
    const fill = conflicts.find((c) => c.field === 'fillColor')
    expect(fill?.options).toEqual(['#ff0000', '#00ff00', null]) // null = layer default
  })

  it('keeps a shared parentId without conflict, flags differing ones', () => {
    const same = resolveMerge(
      [span('a', 0, 10, { parentId: 'p1' }), span('b', 10, 20, { parentId: 'p1' })],
      mkId,
    )
    expect(same.conflicts.find((c) => c.field === 'parentId')).toBeUndefined()
    expect(same.draft.parentId).toBe('p1')

    const differ = resolveMerge(
      [span('a', 0, 10, { parentId: 'p1' }), span('b', 10, 20, { parentId: null })],
      mkId,
    )
    const parent = differ.conflicts.find((c) => c.field === 'parentId')
    expect(parent?.options).toEqual(['p1', null]) // null = "None"
  })

  it('flags differing annotations as a conflict (per Phase 2.5 decision)', () => {
    const s1 = span('a', 0, 10, { annotation: 'tonic pedal' })
    const s2 = span('b', 10, 20, { annotation: 'dominant prep' })
    const { conflicts } = resolveMerge([s1, s2], mkId)
    expect(conflicts.find((c) => c.field === 'annotation')?.options).toEqual([
      'tonic pedal',
      'dominant prep',
    ])
  })
})

describe('finalizeMerge', () => {
  it('applies choices and re-derives the slug from a chosen label', () => {
    const { draft } = resolveMerge(
      [
        span('a', 0, 10, { label: 'Verse', type: 'verse' }),
        span('b', 10, 20, { label: 'Verse 1', type: 'pre-chorus' }),
      ],
      mkId,
    )
    const final = finalizeMerge(draft, { label: 'Verse 1', type: 'verse' })
    expect(final.label).toBe('Verse 1')
    expect(final.slug).toBe('verse-1')
    expect(final.type).toBe('verse')
  })

  it('applies a null color choice (layer default) and null parent (None)', () => {
    const { draft } = resolveMerge(
      [
        span('a', 0, 10, { fillColor: '#ff0000', parentId: 'p1' }),
        span('b', 10, 20, { fillColor: '#00ff00', parentId: 'p2' }),
      ],
      mkId,
    )
    const final = finalizeMerge(draft, { fillColor: null, parentId: null })
    expect(final.fillColor).toBeNull()
    expect(final.parentId).toBeNull()
  })
})
