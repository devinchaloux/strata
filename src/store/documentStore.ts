import { create } from 'zustand'
import { temporal } from 'zundo'
import type { StrataDocument, Layer, Span, PointMarker, SharedTimePoint } from '@/types/strata'
import type { FormDiagramData } from '@/types/strata'

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

  // Document lifecycle
  loadDocument: (doc: StrataDocument) => void
  clearDocument: () => void
  updateMeta: (patch: Partial<DocumentMeta>) => void
  markSaved: () => void

  // Layer actions
  addLayer: (layer: Layer) => void
  updateLayer: (id: string, patch: Partial<Omit<Layer, 'id' | 'type'>>) => void
  removeLayer: (id: string) => void

  // Span actions
  addSpan: (layerId: string, span: Span) => void
  updateSpan: (layerId: string, spanId: string, patch: Partial<Omit<Span, 'id'>>) => void
  removeSpan: (layerId: string, spanId: string) => void
  mergeSpans: (layerId: string, spanIds: string[], result: Span) => void

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

      loadDocument: (doc) => {
        set({ document: doc, savedSnapshot: JSON.stringify(doc) })
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
