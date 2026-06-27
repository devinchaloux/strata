import { create } from 'zustand'
import { temporal } from 'zundo'
import type { StrataDocument, Layer, Span, PointMarker, SharedTimePoint } from '@/types/strata'
import type { FormDiagramData } from '@/types/strata'
import { placeBoundaryInSpans, MIN_SPAN_WIDTH } from '@/lib/spanEdit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentMeta = Pick<
  StrataDocument,
  | 'title'
  | 'artist'
  | 'context'
  | 'duration'
  | 'source'
  | 'composer'
  | 'work'
  | 'derivativeOf'
  | 'notes'
  | 'bpm'
  | 'timeSignature'
  | 'project'
  | 'analysisAuthor'
>

interface DocumentState {
  document: StrataDocument | null
  // Serialized snapshot of the document at the time of last save.
  // null = document has never been saved (treat as dirty if document exists).
  // isDirty is computed from this — see selectIsDirty below.
  savedSnapshot: string | null
  // Monotonic counter bumped on every loadDocument. Lets view-state effects
  // (e.g. the timeline's auto-fit-on-load) fire once per *load* — including
  // reloading the same document or a different one of identical duration —
  // rather than keying on a value like duration that can collide. Excluded from
  // undo history (partialize) and from dirty/save comparisons (document-only).
  loadId: number

  // Document lifecycle
  loadDocument: (doc: StrataDocument) => void
  clearDocument: () => void
  updateMeta: (patch: Partial<DocumentMeta>) => void
  markSaved: () => void

  // Layer actions
  addLayer: (layer: Layer) => void
  updateLayer: (id: string, patch: Partial<Omit<Layer, 'id' | 'type'>>) => void
  removeLayer: (id: string) => void
  // Reorder: given the layer ids in their new top-to-bottom display order,
  // reassign the displayOrder values those layers already hold (top gets the
  // highest). Permutes only among the passed layers; any others are untouched.
  reorderLayers: (idsTopToBottom: string[]) => void

  // Span actions
  addSpan: (layerId: string, span: Span) => void
  updateSpan: (layerId: string, spanId: string, patch: Partial<Omit<Span, 'id'>>) => void
  // Bulk edit: apply one patch to many spans (the set may span multiple layers).
  // A single store write = one undo step. Used by the multi-select metadata panel.
  updateSpans: (spanIds: string[], patch: Partial<Omit<Span, 'id'>>) => void
  removeSpan: (layerId: string, spanId: string) => void
  mergeSpans: (layerId: string, spanIds: string[], result: Span) => void
  // Spacebar / Split: place a boundary at `time`, splitting the containing span
  // (or seeding two spans on an empty layer). No-op if the cut isn't valid.
  placeBoundary: (layerId: string, time: number) => void
  // Boundary drag: move the shared boundary between two adjacent spans to `time`,
  // clamped so neither span shrinks below `minWidth` seconds (hard-stop). The
  // caller passes a zoom-aware minWidth; the store still floors it at the data
  // minimum (MIN_SPAN_WIDTH).
  setAdjacentBoundary: (
    layerId: string,
    leftSpanId: string,
    rightSpanId: string,
    time: number,
    minWidth?: number,
  ) => void

  // Point marker actions
  addPointMarker: (marker: PointMarker) => void
  updatePointMarker: (id: string, patch: Partial<Omit<PointMarker, 'id'>>) => void
  removePointMarker: (id: string) => void

  // Shared time point pool
  // Replaces all pool entries contributed by layerId with the given points.
  // Called by each widget's contributeTimePoints on any data change.
  syncLayerTimePoints: (layerId: string, points: SharedTimePoint[]) => void
}

// ---------------------------------------------------------------------------
// Derived selector
// ---------------------------------------------------------------------------

/**
 * Computes dirty state by comparing the current document against the saved
 * snapshot. Components subscribe to this rather than a stored boolean so the
 * flag clears automatically when undo walks back to the last-saved state.
 */
export const selectIsDirty = (state: DocumentState): boolean => {
  if (!state.document) return false
  if (state.savedSnapshot === null) return true
  return JSON.stringify(state.document) !== state.savedSnapshot
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString()
}

function mapLayer(layers: Layer[], id: string, fn: (layer: Layer) => Layer): Layer[] {
  return layers.map((l) => (l.id === id ? fn(l) : l))
}

function mapFormDiagramSpans(layer: Layer, fn: (spans: Span[]) => Span[]): Layer {
  if (layer.type !== 'form-diagram') return layer
  const data = layer.data as FormDiagramData
  return { ...layer, data: { ...data, spans: fn(data.spans) } }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useDocumentStore = create<DocumentState>()(
  temporal(
    (set, get) => ({
      document: null,
      savedSnapshot: null,
      loadId: 0,

      loadDocument: (doc) => {
        set((s) => ({
          document: doc,
          savedSnapshot: JSON.stringify(doc),
          loadId: s.loadId + 1,
        }))
        // Clear undo history so the loaded state is the base, not an undo target.
        // Caller invokes useDocumentStore.temporal.getState().clear() after this returns.
      },

      clearDocument: () => {
        set({ document: null, savedSnapshot: null })
      },

      updateMeta: (patch) => {
        const doc = get().document
        if (!doc) return
        set({ document: { ...doc, ...patch, updatedAt: now() } })
      },

      markSaved: () => {
        const doc = get().document
        set({ savedSnapshot: doc ? JSON.stringify(doc) : null })
      },

      // --- Layers ---

      addLayer: (layer) => {
        const doc = get().document
        if (!doc) return
        set({ document: { ...doc, layers: [...doc.layers, layer], updatedAt: now() } })
      },

      updateLayer: (id, patch) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, id, (l) => ({ ...l, ...patch })),
            updatedAt: now(),
          },
        })
      },

      removeLayer: (id) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: doc.layers.filter((l) => l.id !== id),
            sharedTimePoints: doc.sharedTimePoints.filter((p) => p.sourceLayerId !== id),
            updatedAt: now(),
          },
        })
      },

      reorderLayers: (idsTopToBottom) => {
        const doc = get().document
        if (!doc) return
        // The displayOrder values these layers currently occupy, highest first.
        // Reassigning the same values to the new order keeps every other layer
        // (e.g. hidden ones not in the list) exactly where it sits numerically.
        const slots = idsTopToBottom
          .map((id) => doc.layers.find((l) => l.id === id)?.displayOrder)
          .filter((v): v is number => v !== undefined)
          .sort((a, b) => b - a)
        const orderById = new Map<string, number>()
        idsTopToBottom.forEach((id, i) => {
          if (slots[i] !== undefined) orderById.set(id, slots[i])
        })
        set({
          document: {
            ...doc,
            layers: doc.layers.map((l) =>
              orderById.has(l.id) ? { ...l, displayOrder: orderById.get(l.id)! } : l,
            ),
            updatedAt: now(),
          },
        })
      },

      // --- Spans ---

      addSpan: (layerId, span) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) =>
                [...spans, span].sort((a, b) => a.startTime - b.startTime)
              )
            ),
            updatedAt: now(),
          },
        })
      },

      updateSpan: (layerId, spanId, patch) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) =>
                spans
                  .map((s) => (s.id === spanId ? { ...s, ...patch } : s))
                  .sort((a, b) => a.startTime - b.startTime)
              )
            ),
            updatedAt: now(),
          },
        })
      },

      updateSpans: (spanIds, patch) => {
        const doc = get().document
        if (!doc || spanIds.length === 0) return
        const ids = new Set(spanIds)
        set({
          document: {
            ...doc,
            layers: doc.layers.map((l) =>
              mapFormDiagramSpans(l, (spans) =>
                spans
                  .map((s) => (ids.has(s.id) ? { ...s, ...patch } : s))
                  .sort((a, b) => a.startTime - b.startTime),
              ),
            ),
            updatedAt: now(),
          },
        })
      },

      removeSpan: (layerId, spanId) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) => spans.filter((s) => s.id !== spanId))
            ),
            updatedAt: now(),
          },
        })
      },

      mergeSpans: (layerId, spanIds, result) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) =>
                [...spans.filter((s) => !spanIds.includes(s.id)), result].sort(
                  (a, b) => a.startTime - b.startTime
                )
              )
            ),
            updatedAt: now(),
          },
        })
      },

      placeBoundary: (layerId, time) => {
        const doc = get().document
        if (!doc) return
        let changed = false
        const layers = mapLayer(doc.layers, layerId, (l) => {
          if (l.type !== 'form-diagram') return l
          const data = l.data as FormDiagramData
          const next = placeBoundaryInSpans(
            data.spans,
            time,
            doc.duration,
            () => crypto.randomUUID(),
          )
          if (!next) return l
          changed = true
          return { ...l, data: { ...data, spans: next } }
        })
        if (!changed) return
        set({ document: { ...doc, layers, updatedAt: now() } })
      },

      setAdjacentBoundary: (layerId, leftSpanId, rightSpanId, time, minWidth) => {
        const doc = get().document
        if (!doc) return
        const gap = Math.max(MIN_SPAN_WIDTH, minWidth ?? MIN_SPAN_WIDTH)
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) => {
                const left = spans.find((s) => s.id === leftSpanId)
                const right = spans.find((s) => s.id === rightSpanId)
                if (!left || !right) return spans
                // Hard-stop: keep both spans at least `gap` seconds wide.
                const min = left.startTime + gap
                const max = right.endTime - gap
                if (min > max) return spans // too narrow to satisfy on both sides
                const t = Math.max(min, Math.min(max, time))
                return spans.map((s) => {
                  if (s.id === leftSpanId) return { ...s, endTime: t }
                  if (s.id === rightSpanId) return { ...s, startTime: t }
                  return s
                })
              }),
            ),
            updatedAt: now(),
          },
        })
      },

      // --- Point Markers ---

      addPointMarker: (marker) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            pointMarkers: [...doc.pointMarkers, marker].sort(
              (a, b) => a.timestamp - b.timestamp
            ),
            updatedAt: now(),
          },
        })
      },

      updatePointMarker: (id, patch) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            pointMarkers: doc.pointMarkers
              .map((m) => (m.id === id ? { ...m, ...patch } : m))
              .sort((a, b) => a.timestamp - b.timestamp),
            updatedAt: now(),
          },
        })
      },

      removePointMarker: (id) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            pointMarkers: doc.pointMarkers.filter((m) => m.id !== id),
            updatedAt: now(),
          },
        })
      },

      // --- Shared Time Point Pool ---

      syncLayerTimePoints: (layerId, points) => {
        const doc = get().document
        if (!doc) return
        const existing = doc.sharedTimePoints.filter((p) => p.sourceLayerId !== layerId)
        set({
          document: {
            ...doc,
            sharedTimePoints: [...existing, ...points].sort(
              (a, b) => a.timestamp - b.timestamp
            ),
            updatedAt: now(),
          },
        })
      },
    }),
    {
      // Only document changes go into the undo/redo history.
      // savedSnapshot is excluded — it tracks save state, not edit history.
      partialize: (state) => ({ document: state.document }),
    }
  )
)

export { useDocumentStore }
export type { DocumentState }
