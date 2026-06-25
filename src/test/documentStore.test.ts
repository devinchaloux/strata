import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '@/store/documentStore'
import type { StrataDocument, Layer, Span, FormDiagramData } from '@/types/strata'

// Minimal layer/doc builders for exercising store actions in isolation.
function layer(id: string, displayOrder: number, visibility = true): Layer {
  return {
    id,
    type: 'form-diagram',
    label: id,
    visibility,
    locked: false,
    fillColorDefault: '#ffffff',
    strokeColorDefault: '#475569',
    displayOrder,
    data: { hierarchicalEnforcement: false, spans: [] },
  }
}

function doc(layers: Layer[]): StrataDocument {
  return {
    strataVersion: '0.1.0',
    fileFormatVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Test',
    artist: ['Tester'],
    duration: 100,
    source: { type: 'youtube', url: 'https://youtu.be/x', sourceOffset: 0 },
    vocabulary: { spanTypes: [], pointMarkerTypes: [] },
    sharedTimePoints: [],
    layers,
    pointMarkers: [],
  }
}

/** Layer ids in display order, top (highest displayOrder) first. */
function topToBottom(): string[] {
  const ls = useDocumentStore.getState().document!.layers
  return [...ls].sort((a, b) => b.displayOrder - a.displayOrder).map((l) => l.id)
}

describe('reorderLayers', () => {
  beforeEach(() => {
    // Top-to-bottom starts as c(2), b(1), a(0).
    useDocumentStore.getState().loadDocument(doc([layer('a', 0), layer('b', 1), layer('c', 2)]))
  })

  it('reorders to the given top-to-bottom order', () => {
    useDocumentStore.getState().reorderLayers(['b', 'c', 'a'])
    expect(topToBottom()).toEqual(['b', 'c', 'a'])
  })

  it('only permutes existing displayOrder values (no new values invented)', () => {
    useDocumentStore.getState().reorderLayers(['a', 'b', 'c'])
    const orders = useDocumentStore.getState().document!.layers.map((l) => l.displayOrder).sort()
    expect(orders).toEqual([0, 1, 2])
  })

  it('leaves layers not in the reorder list at their displayOrder', () => {
    // Reorder only the subset {a, b}; c must keep displayOrder 2 (stays on top).
    useDocumentStore.getState().reorderLayers(['a', 'b'])
    const byId = Object.fromEntries(
      useDocumentStore.getState().document!.layers.map((l) => [l.id, l.displayOrder]),
    )
    expect(byId.c).toBe(2)
    // a and b swap among their own slots {0, 1}: a was 0, b was 1 → a=1, b=0.
    expect(byId.a).toBe(1)
    expect(byId.b).toBe(0)
    expect(topToBottom()).toEqual(['c', 'a', 'b'])
  })

  it('is a no-op-safe call when ids match current order', () => {
    useDocumentStore.getState().reorderLayers(['c', 'b', 'a'])
    expect(topToBottom()).toEqual(['c', 'b', 'a'])
  })
})

describe('loadId (re-fit-on-load signal)', () => {
  it('increments on every loadDocument, even for identical documents', () => {
    const start = useDocumentStore.getState().loadId
    useDocumentStore.getState().loadDocument(doc([layer('a', 0)]))
    const first = useDocumentStore.getState().loadId
    expect(first).toBe(start + 1)
    // Reloading a document of the same duration must still bump loadId, so the
    // timeline re-fits (the bug was keying on duration, which collides here).
    useDocumentStore.getState().loadDocument(doc([layer('a', 0)]))
    expect(useDocumentStore.getState().loadId).toBe(first + 1)
  })

  it('is not affected by document edits (only loads bump it)', () => {
    useDocumentStore.getState().loadDocument(doc([layer('a', 0)]))
    const afterLoad = useDocumentStore.getState().loadId
    useDocumentStore.getState().updateLayer('a', { label: 'renamed' })
    expect(useDocumentStore.getState().loadId).toBe(afterLoad)
  })
})

describe('updateSpans (bulk edit)', () => {
  function spanLayer(id: string, spans: Span[]): Layer {
    return { ...layer(id, 0), data: { hierarchicalEnforcement: false, spans } }
  }
  function spansOf(layerId: string): Span[] {
    const l = useDocumentStore.getState().document!.layers.find((x) => x.id === layerId)!
    return (l.data as FormDiagramData).spans
  }

  beforeEach(() => {
    useDocumentStore.getState().loadDocument(
      doc([
        spanLayer('L1', [
          { id: 'a', startTime: 0, endTime: 10 },
          { id: 'b', startTime: 10, endTime: 20 },
          { id: 'c', startTime: 20, endTime: 30 },
        ]),
      ]),
    )
    useDocumentStore.temporal.getState().clear()
  })

  it('applies one patch to every targeted span and leaves others untouched', () => {
    useDocumentStore.getState().updateSpans(['a', 'c'], { type: 'chorus' })
    const byId = Object.fromEntries(spansOf('L1').map((s) => [s.id, s.type]))
    expect(byId).toEqual({ a: 'chorus', b: undefined, c: 'chorus' })
  })

  it('is a single undo step for the whole bulk edit', () => {
    useDocumentStore.getState().updateSpans(['a', 'b', 'c'], { confidence: 'approximate' })
    expect(spansOf('L1').every((s) => s.confidence === 'approximate')).toBe(true)
    useDocumentStore.temporal.getState().undo()
    expect(spansOf('L1').every((s) => s.confidence === undefined)).toBe(true)
  })
})
