import { create } from 'zustand'
import { temporal } from 'zundo'
import type { StrataDocument, Layer, LayerBase, Span, PointMarker, SharedTimePoint, GridSegment, VocabTerm } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { sortedSegments, segmentAt, segmentEnd, extendBack } from '@/lib/beatGrid'
import type { FormDiagramData } from '@/types/strata'
import { placeBoundaryInSpans, setSpanEdge, findOverlaps, MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import { groupingHandleSet, breakHistoryGroup } from '@/store/history'
import { slugify, uniqueSlug, slugsInUse, allSpans, resolveSlugCollisions } from '@/lib/slug'
import {
  setSpanCommentary as withSpanCommentary,
  setRangeCommentary as withRangeCommentary,
  setBlockText as withBlockText,
  reanchorOrphans,
} from '@/widgets/written-analysis/commentary'

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
  | 'homeKey'
  | 'project'
  | 'analysisAuthor'
  | 'showCadenceCaptions'
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
  // Ids of spans whose slug has been saved to a file, and so may be referenced
  // by an embed: their slug no longer follows label edits (see lib/slug.ts).
  // Set on load and on save; not document data, not in undo history.
  frozenSlugIds: Set<string>

  // Document lifecycle
  loadDocument: (doc: StrataDocument) => void
  clearDocument: () => void
  updateMeta: (patch: Partial<DocumentMeta>) => void
  markSaved: () => void

  // Layer actions
  addLayer: (layer: Layer) => void
  // Envelope fields only (label, visibility, colours…); a layer's data changes
  // through the span and commentary actions, which enforce its invariants.
  updateLayer: (id: string, patch: Partial<Omit<LayerBase, 'id'>>) => void
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
  // Label edits go through these, not updateSpan, because a label change may
  // carry a slug change: an unfrozen slug follows the label, kept unique.
  setSpanLabels: (spanIds: string[], label: string | null) => void
  // Explicitly re-derive a span's slug from its current label, frozen or not.
  regenerateSlug: (spanId: string) => void
  // Written analysis: set or clear (empty text) a span's commentary. The first
  // commentary creates the document's written-analysis layer.
  setSpanCommentary: (spanId: string, text: string) => void
  // Commentary on a stretch of time rather than one span (empty text clears).
  setRangeCommentary: (start: number, end: number, text: string) => void
  // Edit (or, with empty text, remove) one commentary block by id.
  setCommentaryText: (blockId: string, text: string) => void
  removeSpan: (layerId: string, spanId: string) => void
  mergeSpans: (layerId: string, spanIds: string[], result: Span) => void
  // Spacebar / Split: place a boundary at `time`, splitting the containing span
  // (or filling the gap it falls in — an empty layer is one gap). No-op if the
  // cut isn't valid.
  placeBoundary: (layerId: string, time: number) => void
  // Numeric time entry: move one edge of a span. A touching neighbour's edge
  // moves with it; otherwise the edge stops at the gap's far side.
  setSpanEdge: (layerId: string, spanId: string, edge: 'start' | 'end', time: number) => void
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
  /** Add a term to the file's own vocabulary, unless one with its id is already there. */
  addVocabTerm: (list: 'spanTypes' | 'pointMarkerTypes', term: VocabTerm) => void
  removePointMarker: (id: string) => void

  // Beat grid (lib/beatGrid.ts). startGridAt begins a segment on the downbeat
  // at `time`; one already running there simply ends at it, so the same action
  // picks the grid up after a free stretch, changes tempo, or renumbers.
  startGridAt: (time: number) => void
  // The segment running at `time` stops there; a free stretch follows.
  endGridAt: (time: number) => void
  updateGridSegment: (id: string, patch: Partial<Omit<GridSegment, 'id'>>) => void
  // Tap-along: lay (or, with `id`, refine) a segment from a run of taps whose
  // first fell on a downbeat. Returns the segment's id for the next tap.
  layGridFromTaps: (start: number, bpm: number, id?: string | null) => string | null
  removeGridSegment: (id: string) => void

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

// Every span write funnels through here, which is where the tiling invariant
// is enforced: a write that would make two spans in one layer overlap is
// dropped and the layer is returned unchanged (docs/decisions.md, 2026-09-27).
// Gestures already respect the invariant; this catches any caller that doesn't.
function mapFormDiagramSpans(layer: Layer, fn: (spans: Span[]) => Span[]): Layer {
  if (layer.type !== 'form-diagram') return layer
  const data = layer.data as FormDiagramData
  const next = fn(data.spans)
  // Untouched layers keep their identity, so memoized layers don't re-render:
  // on a large analysis a one-span edit used to redraw every layer.
  if (next === data.spans) return layer
  if (findOverlaps(next).length > findOverlaps(data.spans).length) return layer
  return { ...layer, data: { ...data, spans: next } }
}

/** Apply a per-span patch function to every span whose id is in `ids`. */
function patchSpans(doc: StrataDocument, ids: Set<string>, fn: (s: Span) => Span): StrataDocument {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      mapFormDiagramSpans(l, (spans) => (spans.some((s) => ids.has(s.id)) ? spans.map((s) => (ids.has(s.id) ? fn(s) : s)) : spans)),
    ),
  }
}

/** Span and marker ids that currently carry a slug — the set that becomes frozen on save. */
function slugBearingIds(doc: StrataDocument | null): Set<string> {
  return new Set(doc ? [...allSpans(doc), ...doc.pointMarkers].filter((s) => s.slug).map((s) => s.id) : [])
}

/**
 * A marker's slug after a label write: follows the label unless frozen (saved
 * and so maybe linked to), unique across spans and markers.
 */
function markerSlug(doc: StrataDocument, marker: PointMarker, frozen: Set<string>): string | null | undefined {
  if (frozen.has(marker.id) && marker.slug) return marker.slug
  const base = marker.label ? slugify(marker.label) : null
  return base ? uniqueSlug(base, slugsInUse(doc, new Set([marker.id]))) : null
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
      frozenSlugIds: new Set<string>(),

      loadDocument: (doc) => {
        set((s) => ({
          document: doc,
          savedSnapshot: JSON.stringify(doc),
          loadId: s.loadId + 1,
          frozenSlugIds: slugBearingIds(doc),
        }))
        // Clear undo history so the loaded state is the base, not an undo target.
        // Caller invokes useDocumentStore.temporal.getState().clear() after this returns.
      },

      clearDocument: () => {
        set({ document: null, savedSnapshot: null, frozenSlugIds: new Set() })
      },

      updateMeta: (patch) => {
        const doc = get().document
        if (!doc) return
        set({ document: { ...doc, ...patch, updatedAt: now() } })
      },

      markSaved: () => {
        const doc = get().document
        set({ savedSnapshot: doc ? JSON.stringify(doc) : null, frozenSlugIds: slugBearingIds(doc) })
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
        // A deleted form layer takes its spans with it; their commentary stays,
        // re-anchored to the times those spans covered.
        const next = {
          ...doc,
          layers: doc.layers.filter((l) => l.id !== id),
          sharedTimePoints: doc.sharedTimePoints.filter((p) => p.sourceLayerId !== id),
          updatedAt: now(),
        }
        set({ document: reanchorOrphans(doc, next) })
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

      setSpanLabels: (spanIds, label) => {
        const doc = get().document
        if (!doc || spanIds.length === 0) return
        const ids = new Set(spanIds)
        const frozen = get().frozenSlugIds
        // Slugs being replaced don't count as taken; assign in time order so a
        // bulk "Verse" labelling reads verse, verse-2, verse-3 left to right.
        const taken = slugsInUse(doc, new Set(spanIds.filter((id) => !frozen.has(id))))
        const base = label ? slugify(label) : null
        const order = allSpans(doc)
          .filter((s) => ids.has(s.id))
          .sort((a, b) => a.startTime - b.startTime)
        const slugFor = new Map<string, string | null>()
        for (const s of order) {
          if (frozen.has(s.id)) continue
          const slug = base ? uniqueSlug(base, taken) : null
          if (slug) taken.add(slug)
          slugFor.set(s.id, slug)
        }
        const next = patchSpans(doc, ids, (s) =>
          slugFor.has(s.id) ? { ...s, label, slug: slugFor.get(s.id)! } : { ...s, label },
        )
        set({ document: { ...next, updatedAt: now() } })
      },

      regenerateSlug: (spanId) => {
        const doc = get().document
        const span = doc && allSpans(doc).find((s) => s.id === spanId)
        if (!doc || !span) return
        const base = span.label ? slugify(span.label) : null
        const slug = base ? uniqueSlug(base, slugsInUse(doc, new Set([spanId]))) : null
        set({ document: { ...patchSpans(doc, new Set([spanId]), (s) => ({ ...s, slug })), updatedAt: now() } })
      },

      removeSpan: (layerId, spanId) => {
        const doc = get().document
        if (!doc) return
        const next = {
          ...doc,
          layers: mapLayer(doc.layers, layerId, (l) =>
            mapFormDiagramSpans(l, (spans) => spans.filter((s) => s.id !== spanId))
          ),
          updatedAt: now(),
        }
        // The span's commentary survives, anchored to the span's old times.
        set({ document: reanchorOrphans(doc, next) })
      },

      mergeSpans: (layerId, spanIds, result) => {
        const doc = get().document
        if (!doc) return
        // The merged span is new, but if its label came from one of the
        // sources, so does that source's slug — an embed pointing at it keeps
        // working. Otherwise the merge draft's derived slug stands.
        const heir = allSpans(doc).find((s) => spanIds.includes(s.id) && s.slug && s.label === result.label)
        if (heir) result = { ...result, slug: heir.slug }
        const withoutSources = new Set(spanIds)
        if (result.slug) result = { ...result, slug: uniqueSlug(result.slug, slugsInUse(doc, withoutSources)) }
        // An inherited frozen slug stays frozen on its new span.
        if (heir && get().frozenSlugIds.has(heir.id) && result.slug === heir.slug) {
          set({ frozenSlugIds: new Set([...get().frozenSlugIds, result.id]) })
        }
        const next = {
          ...doc,
          layers: mapLayer(doc.layers, layerId, (l) =>
            mapFormDiagramSpans(l, (spans) =>
              [...spans.filter((s) => !spanIds.includes(s.id)), result].sort(
                (a, b) => a.startTime - b.startTime
              )
            )
          ),
          updatedAt: now(),
        }
        // The sources' commentary moves to the merged span (combined).
        set({ document: reanchorOrphans(doc, next) })
      },

      setSpanCommentary: (spanId, text) => {
        const doc = get().document
        if (!doc) return
        const next = withSpanCommentary(doc, spanId, text, () => crypto.randomUUID())
        if (next !== doc) set({ document: { ...next, updatedAt: now() } })
      },

      setRangeCommentary: (start, end, text) => {
        const doc = get().document
        if (!doc || !(end > start)) return
        const next = withRangeCommentary(doc, start, end, text, () => crypto.randomUUID())
        if (next !== doc) set({ document: { ...next, updatedAt: now() } })
      },

      setCommentaryText: (blockId, text) => {
        const doc = get().document
        if (!doc) return
        const next = withBlockText(doc, blockId, text)
        if (next !== doc) set({ document: { ...next, updatedAt: now() } })
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
        // A split copies the label (and so the slug) into the new right half;
        // the original span keeps its slug and the new half gets the next free one.
        set({ document: resolveSlugCollisions(doc, { ...doc, layers, updatedAt: now() }) })
      },

      setSpanEdge: (layerId, spanId, edge, time) => {
        const doc = get().document
        if (!doc) return
        set({
          document: {
            ...doc,
            layers: mapLayer(doc.layers, layerId, (l) =>
              mapFormDiagramSpans(l, (spans) => setSpanEdge(spans, spanId, edge, time, doc.duration) ?? spans),
            ),
            updatedAt: now(),
          },
        })
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
        if (marker.label && marker.slug === undefined) marker = { ...marker, slug: markerSlug(doc, marker, new Set()) }
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

      addVocabTerm: (list, term) => {
        const doc = get().document
        if (!doc || doc.vocabulary[list].some((t) => t.id === term.id)) return
        set({
          document: {
            ...doc,
            vocabulary: { ...doc.vocabulary, [list]: [...doc.vocabulary[list], term] },
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
              .map((m) => {
                if (m.id !== id) return m
                const next = { ...m, ...patch }
                // A label change carries a slug change, as for spans.
                return 'label' in patch ? { ...next, slug: markerSlug(doc, next, get().frozenSlugIds) } : next
              })
              .sort((a, b) => a.timestamp - b.timestamp),
            updatedAt: now(),
          },
        })
      },

      startGridAt: (time) => {
        const doc = get().document
        if (!doc) return
        const segs = sortedSegments(doc.beatGrid)
        if (segs.some((g) => Math.abs(g.start - time) < 0.05)) return
        const running = segmentAt(segs, time, doc.duration)?.seg
        // Carry the tempo and meter on from the segment running here, else the
        // last one before; the document's tempo and meter are the first default.
        const before = [...segs].reverse().find((g) => g.start < time)
        const model = running ?? before
        const seg: GridSegment = {
          id: crypto.randomUUID(),
          start: time,
          bpm: model?.bpm ?? doc.bpm ?? 120,
          beatsPerBar: model?.beatsPerBar ?? doc.timeSignature?.numerator ?? 4,
          ...(model?.beatUnit ?? doc.timeSignature?.denominator ? { beatUnit: model?.beatUnit ?? doc.timeSignature?.denominator } : {}),
          // A split segment's own stopping point now belongs to the new one.
          ...(running?.end != null && running.end > time ? { end: running.end } : {}),
        }
        set({ document: { ...doc, beatGrid: sortedSegments([...segs, seg]), updatedAt: now() } })
      },

      endGridAt: (time) => {
        const doc = get().document
        if (!doc) return
        const segs = sortedSegments(doc.beatGrid)
        const hit = segmentAt(segs, time, doc.duration)
        if (!hit || time <= hit.seg.start) return
        set({
          document: {
            ...doc,
            beatGrid: segs.map((g) => (g.id === hit.seg.id ? { ...g, end: time } : g)),
            updatedAt: now(),
          },
        })
      },

      layGridFromTaps: (tappedStart, bpm, id) => {
        const doc = get().document
        if (!doc) return null
        const segs = sortedSegments(doc.beatGrid)
        const own = segs.find((g) => g.id === id)
        const others = segs.filter((g) => g.id !== id)
        // Reach back to where the music plausibly starts: the latest section
        // boundary before the taps, or the end of the grid before them, or the
        // track's start. Taps inside a running segment mark a tempo change
        // there instead, so they don't reach back.
        const inRunning = segmentAt(others, tappedStart, doc.duration)
        const beatsPerBar = (own ?? inRunning?.seg ?? others.find((g) => g.start < tappedStart))?.beatsPerBar
          ?? doc.timeSignature?.numerator ?? 4
        let start = tappedStart
        if (!inRunning) {
          const gridFloor = Math.max(0, ...others.map((_, i) => segmentEnd(others, i, doc.duration)).filter((e) => e <= tappedStart))
          const boundaryFloor = Math.max(
            0,
            ...doc.layers.flatMap(formSpans).flatMap((s) => [s.startTime, s.endTime]).filter((t) => t <= tappedStart + 0.05),
          )
          start = extendBack(tappedStart, (beatsPerBar * 60) / bpm, Math.max(gridFloor, boundaryFloor))
        }
        // The same run refines its own segment; a run that begins on a segment's
        // first downbeat (within half a beat) refines that one instead of
        // stacking a second segment on top of it.
        const existing =
          segs.find((g) => g.id === id) ?? segs.find((g) => Math.abs(g.start - start) < 30 / bpm)
        if (existing) {
          set({
            document: {
              ...doc,
              beatGrid: sortedSegments(segs.map((g) => (g.id === existing.id ? { ...g, start, bpm } : g))),
              updatedAt: now(),
            },
          })
          return existing.id
        }
        const running = segmentAt(segs, start, doc.duration)?.seg
        const before = [...segs].reverse().find((g) => g.start < start)
        const model = running ?? before
        const beatUnit = model?.beatUnit ?? doc.timeSignature?.denominator
        const seg: GridSegment = {
          id: crypto.randomUUID(),
          start,
          bpm,
          beatsPerBar: model?.beatsPerBar ?? doc.timeSignature?.numerator ?? 4,
          ...(beatUnit ? { beatUnit } : {}),
          ...(running?.end != null && running.end > start ? { end: running.end } : {}),
        }
        set({ document: { ...doc, beatGrid: sortedSegments([...segs, seg]), updatedAt: now() } })
        return seg.id
      },

      updateGridSegment: (id, patch) => {
        const doc = get().document
        if (!doc?.beatGrid) return
        set({
          document: {
            ...doc,
            beatGrid: sortedSegments(doc.beatGrid.map((g) => (g.id === id ? { ...g, ...patch } : g))),
            updatedAt: now(),
          },
        })
      },

      removeGridSegment: (id) => {
        const doc = get().document
        if (!doc?.beatGrid) return
        set({ document: { ...doc, beatGrid: doc.beatGrid.filter((g) => g.id !== id), updatedAt: now() } })
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
      // Writes that don't change the document (markSaved, loadId bumps) are
      // not undo steps. Every action builds a new document object, so identity
      // is an exact test.
      equality: (past, current) => past.document === current.document,
      // Continuous gestures (drags, typing) collapse into one step each — see
      // store/history.ts. The cast bridges zundo's loosely-typed option.
      handleSet: groupingHandleSet as never,
    }
  )
)

// Undo, redo and clear end whatever group was open, so the next edit after an
// undo is its own step rather than silently joining the one before it.
{
  const temporal = useDocumentStore.temporal
  const { undo, redo, clear } = temporal.getState()
  temporal.setState({
    undo: (steps?: number) => {
      breakHistoryGroup()
      undo(steps)
    },
    redo: (steps?: number) => {
      breakHistoryGroup()
      redo(steps)
    },
    clear: () => {
      breakHistoryGroup()
      clear()
    },
  })
}

export { useDocumentStore }
export type { DocumentState }
