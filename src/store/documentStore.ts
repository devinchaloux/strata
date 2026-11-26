import { create } from 'zustand'
import { temporal } from 'zundo'
import type { StrataDocument, Layer, LayerBase, Span, PointMarker, GridSegment, Hypermeter, VocabTerm, BlockType, TempoData, TempoLayer } from '@/types/strata'
import { moveBlock, setBlockHidden, widgetBlocks } from '@/lib/widgets'
import { segmentSpans, newSegmentLayer } from '@/lib/layers'
import { groupUpTarget, placeSpan, copyOfSpan, layerAbove, DEFAULT_COPY_FIELDS, type CopyField } from '@/lib/groupSpans'
import { boundaryMoves, followLinks, repairParentLinks, splitTimeNearChildren, relinkToPieces } from '@/lib/linkedBoundaries'
import { sortedSegments, segmentAt, segmentEnd, extendBack, snapToGrid, barTiling, barLength } from '@/lib/beatGrid'
import { barNumberLabels, boundaryOnBar, countRun, countsByGroups, elideCounts, numberedGridBars, parseHypermeter, phraseRuns, placeOf, splitEvenly } from '@/lib/hypermeter'
import { roundTempo, segmentForAdjusting, tempoThroughDownbeat } from '@/lib/metronome'
import { normalizePlan, runTimes, type Flat, type NormalizeMode } from '@/lib/normalize'
import { gridFromBars as makeGridFromBars, spliceGrid } from '@/lib/gridFromBars'
import { beatsPerBarAt } from '@/lib/tempoLane'
import type { SegmentationData } from '@/types/strata'
import { mergeVocabPack, type MergeResult, type VocabPack } from '@/lib/vocabPack'
import { placeBoundaryInSpans, setSpanEdge, findOverlaps, endSpanAtTime, snapSpansToGrid, rippleSpanEnd, extendSpanToEnd, MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import { groupingHandleSet, breakHistoryGroup } from '@/store/history'
import { slugify, uniqueSlug, slugsInUse, allSpans, resolveSlugCollisions } from '@/lib/slug'
import {
  setSpanCommentary as withSpanCommentary,
  setRangeCommentary as withRangeCommentary,
  setBlockText as withBlockText,
  reanchorOrphans,
  blockForSpan,
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

/** Where groupSpans puts its span: an existing layer, or a new one above (or below) the sources. */
export type GroupTarget = { layerId: string } | { newLayer: string; below?: boolean }

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
  // B (boundary) / Split: place a boundary at `time`, splitting the containing span
  // (or filling the gap it falls in — an empty layer is one gap). No-op if the
  // cut isn't valid. Splitting a parent moves the cut onto a boundary between
  // its children within half a second, and each child then belongs to the half
  // that holds most of it.
  placeBoundary: (layerId: string, time: number) => void
  // A span run on to the end of the track, the later spans in its layer
  // removed (lib/spanEdit.ts, extendSpanToEnd). One undo step.
  extendToEnd: (layerId: string, spanId: string) => void
  // Shift+B: the span under `time` ends there, leaving the rest empty.
  endSpanAt: (layerId: string, time: number) => void
  // Move every boundary in a layer to the nearest bar or beat. One undo step;
  // returns how many boundaries moved.
  snapLayerToGrid: (layerId: string, unit: 'bar' | 'beat') => number
  // Quick setup: tile a layer with a span every `barsPer` bars from the bar
  // line at `start` to where the grid stops (lib/beatGrid.ts, barTiling). With
  // no grid at `start`, one is started there at the document's tempo and
  // meter. One undo step; returns how many spans it made (0 when there is no
  // tempo to go on, or the layer already has spans in that stretch).
  fillLayerWithBars: (layerId: string, start: number, barsPer: number) => number
  // Hypermeter and the bar layer (lib/hypermeter.ts). Counts go into each
  // span's hypermeter, never into its annotation. Each is one undo step.
  // Fill the bar layer, while it is empty, with one span per bar of the grid:
  // labels are the grid's bar numbers, hypermeter counted 1 to `group` and
  // round again. Returns how many spans it made (0 when the layer isn't the
  // bar layer, has spans, or there is no grid).
  numberBars: (layerId: string, group: number) => number
  // Recount the given spans of a layer 1 to `group`, in time order.
  renumberSpans: (layerId: string, spanIds: string[], group: number) => void
  // Make a span the elided bar ("4=1") and count on from 2 after it, until a
  // span with no hypermeter.
  elideSpan: (layerId: string, spanId: string, group: number) => void
  // Make a layer the bar layer, or an ordinary one again. Turning it on takes
  // the role from any other layer; where every label is empty or a count, the
  // counts move into the spans' hypermeter (where it is empty) and the labels
  // become bar numbers from 1.
  setBarLayer: (layerId: string, on: boolean) => void
  // Label a layer's spans (or only `spanIds`) with bar numbers from `first`, in time order.
  numberBarLayer: (layerId: string, first: number, spanIds?: string[]) => void
  // Count the bars of a layer (or only `spanIds`): by the spans of layer
  // `byLayerId` (each group counts from 1 to its end), or in groups of `group`
  // from the first when it is null. Returns how many bars it counted.
  countBars: (layerId: string, byLayerId: string | null, group: number, spanIds?: string[]) => number
  // Mark elided the boundary another layer has on this bar (lib/hypermeter.ts
  // boundaryOnBar): the end of the span that ends there. The nearest layer
  // above with one there is used. Returns that layer's id, or null if none has one.
  elideGroupBoundary: (layerId: string, spanId: string) => string | null
  // Quick setup between phrases and bars, for any selected run (a chunk of the
  // recording or all of it). One undo step each.
  // Split each selected span into `barsEach` equal bars on the bar layer (null
  // when there is none; the analyst identifies it first): each bar's parent
  // is its phrase, its hypermeter its count, its label its bar number, going on
  // from the bar before. Refused ('occupied') when the bar layer already has
  // bars in that stretch.
  splitIntoBars: (spanIds: string[], barsEach: number) => { made: number; layerId: string } | 'occupied' | null
  // Make phrases from selected counted bars: one starts at the first bar and at
  // every bar counted 1 (lib/hypermeter.ts phraseRuns), on the layer just
  // above theirs when it has nothing in that stretch, else on a new "Phrases"
  // layer there. The bars become the phrases' children; a phrase that starts
  // on an elided bar ("4=1") marks the end of the one before it elided.
  phrasesFromCount: (spanIds: string[]) => { made: number; layerId: string } | null
  // Normalize a run of selected bars that follow one another (lib/normalize.ts):
  // 'steady' makes them equal, 'smooth' fits a smooth tempo curve with
  // smoothing 10^logLambda. The run's two ends stay; boundaries linked to
  // parents or children carry their moves. With `intoNewLayer`, the bars are
  // copied, normalized, to a layer "<name> (normalized)" just below (reused
  // when it is free there) and the originals stay as tapped. One undo step;
  // null when the spans don't follow one another or are too few.
  normalizeBars: (
    spanIds: string[],
    mode: NormalizeMode,
    logLambda: number,
    intoNewLayer: boolean,
    /** For 'ramps': the steady stretches, as boundary indices into the run (findFlats proposes them). */
    flats?: Flat[],
  ) => { moved: number; layerId: string } | null
  // Widgets as blocks (lib/widgets.ts). One undo step each.
  // Add the tempo widget: a tempo layer reading the bar layer, and its block
  // (just below the Segments block), or show the block if it is there. Returns
  // the tempo layer's id, or null when there is no bar layer to read.
  addTempoWidget: () => string | null
  // Remove a widget: its block and every layer of its type. The Segments block
  // can't be removed.
  removeWidget: (type: BlockType) => void
  setWidgetHidden: (type: BlockType, hidden: boolean) => void
  // Move a block one place up (-1) or down (+1).
  moveWidget: (type: BlockType, dir: -1 | 1) => void
  // A tempo layer's display choices, merged; and which layer it reads.
  setTempoDisplay: (layerId: string, display: Partial<NonNullable<TempoData['display']>>) => void
  setTempoSource: (layerId: string, sourceId: string) => void
  // The beat grid from marked bars (lib/gridFromBars.ts): the given bars, or
  // with null every bar of the bar layer, become grid stretches at their own
  // tempos, replacing the grid over the stretch they cover. One undo step;
  // returns how many stretches and bars, or null with no bars.
  gridFromBars: (spanIds: string[] | null) => { stretches: number; bars: number } | null
  // A span one or more bars longer or shorter, every later boundary in its
  // layer moving with it (lib/spanEdit.ts, rippleSpanEnd).
  resizeSpanByBars: (layerId: string, spanId: string, bars: number) => void
  // Group spans into one span on another layer, covering them all; one span
  // is copied there whole (Copy to layer; lib/groupSpans.ts). Grouped spans
  // become the new span's children (parentId); of a span and its copy, the
  // one on the higher layer is the parent. Either way their shared boundaries
  // move together. The target is a form layer (not one of theirs, not locked)
  // or a new layer, named, made just above the highest of theirs (or, with
  // `below`, just below the lowest). Spans already in that stretch are cut
  // back or replaced. A copy takes only the chosen parts (`fields`; lyrics,
  // notes and commentary are off unless chosen). One undo step; returns the
  // new span's id, or null.
  groupSpans: (spanIds: string[], target: GroupTarget, fields?: CopyField[]) => string | null
  // groupSpans into the layer just above theirs, or a new one there if none;
  // null, doing nothing, if that layer has spans in the way (groupUpTarget).
  groupIntoLayerAbove: (spanIds: string[]) => string | null
  // The same, to a length typed in bars ("this phrase is 2 bars"): the span
  // becomes exactly that long and every later boundary moves by the difference.
  setSpanBars: (layerId: string, spanId: string, bars: number) => void
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
  /** Merge a vocabulary pack's terms into the file (lib/vocabPack.ts). One undo step. */
  importVocabPack: (pack: VocabPack) => MergeResult | null
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
  // Beat matching against the click track (lib/metronome.ts). Each acts on
  // the grid row at `time` (or the last before it). Tempo steps keep the row's
  // first downbeat in place; a nudge moves the whole row earlier or later;
  // pinning sets the tempo so the downbeat nearest `time` lands on it, and
  // returns the new tempo and how many bars in that downbeat is (null if
  // `time` is under a bar from the row's start).
  stepGridTempo: (time: number, deltaBpm: number) => void
  nudgeGrid: (time: number, seconds: number) => void
  pinDownbeat: (time: number) => { bpm: number; bars: number } | null
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
function mapSegmentSpans(layer: Layer, fn: (spans: Span[]) => Span[]): Layer {
  if (layer.type !== 'segmentation') return layer
  const data = layer.data as SegmentationData
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
      mapSegmentSpans(l, (spans) => (spans.some((s) => ids.has(s.id)) ? spans.map((s) => (ids.has(s.id) ? fn(s) : s)) : spans)),
    ),
  }
}

/**
 * The layers with `layerId` made the bar layer (on) or an ordinary one (off):
 * a document has at most one bar layer, so turning it on takes it from any other.
 */
function withBarRole(layers: Layer[], layerId: string, on: boolean): Layer[] {
  return layers.map((l) => {
    if (l.id === layerId && on) return { ...l, role: 'bars' as const }
    // Off: only this layer loses the role. On: every other layer does.
    if (l.role !== 'bars' || (!on && l.id !== layerId)) return l
    const rest = { ...l }
    delete rest.role
    return rest
  })
}

/**
 * The selected spans when they all sit on one unlocked form layer, sorted by
 * time; null otherwise.
 */
function pickedOnOneLayer(doc: StrataDocument | null, spanIds: string[]): { layer: Layer; spans: Span[] } | null {
  if (!doc || !spanIds.length) return null
  const layer = doc.layers.find((l) => l.type === 'segmentation' && segmentSpans(l).some((s) => spanIds.includes(s.id)))
  if (!layer || layer.locked) return null
  const spans = segmentSpans(layer).filter((s) => spanIds.includes(s.id))
  if (spans.length !== spanIds.length) return null
  return { layer, spans: [...spans].sort((a, b) => a.startTime - b.startTime) }
}

/**
 * Write `counts` as the hypermeter of `spans`, one to one; a null count clears
 * it. Annotations are never touched. Null when nothing changes.
 */
function writeHypermeter(doc: StrataDocument, spans: Span[], counts: Array<Hypermeter | null | undefined>): StrataDocument | null {
  const same = (a: Hypermeter | null | undefined, b: Hypermeter | null | undefined) =>
    (a?.count ?? null) === (b?.count ?? null) && (a?.becomes ?? null) === (b?.becomes ?? null)
  const changed = new Map<string, Hypermeter | null>()
  spans.forEach((s, k) => {
    if (!same(s.hypermeter, counts[k])) changed.set(s.id, counts[k] ?? null)
  })
  if (!changed.size) return null
  return patchSpans(doc, new Set(changed.keys()), (s) => withHypermeter(s, changed.get(s.id) ?? null))
}

/** `span` with hypermeter `h`, or without the field when `h` is null. */
function withHypermeter(span: Span, h: Hypermeter | null): Span {
  if (h) return { ...span, hypermeter: h }
  const rest = { ...span }
  delete rest.hypermeter
  return rest
}

/**
 * The boundary a layer above `layerId` has on one of its bars, nearest layer
 * first (lib/hypermeter.ts boundaryOnBar), or null when none has one there.
 */
export function groupBoundaryOnBar(
  doc: StrataDocument,
  layerId: string,
  spanId: string,
): { layer: Layer; boundary: { before: Span; after: Span } } | null {
  const layer = doc.layers.find((l) => l.id === layerId)
  const bar = layer && segmentSpans(layer).find((s) => s.id === spanId)
  if (!layer || !bar) return null
  const above = doc.layers
    .filter((l) => l.type === 'segmentation' && l.displayOrder > layer.displayOrder)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  for (const l of above) {
    const boundary = boundaryOnBar([bar.startTime, bar.endTime], [...segmentSpans(l)].sort((a, b) => a.startTime - b.startTime))
    if (boundary) return { layer: l, boundary }
  }
  return null
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

/**
 * Write labels to spans, each slug following its new label (unless frozen),
 * unique and assigned in time order, as setSpanLabels does for one label.
 */
function relabelSpans(doc: StrataDocument, labels: Map<string, string | null>, frozen: Set<string>): StrataDocument {
  const taken = slugsInUse(doc, new Set([...labels.keys()].filter((id) => !frozen.has(id))))
  const slugFor = new Map<string, string | null>()
  const order = allSpans(doc).filter((s) => labels.has(s.id)).sort((a, b) => a.startTime - b.startTime)
  for (const s of order) {
    if (frozen.has(s.id)) continue
    const label = labels.get(s.id)
    const base = label ? slugify(label) : null
    const slug = base ? uniqueSlug(base, taken) : null
    if (slug) taken.add(slug)
    slugFor.set(s.id, slug)
  }
  return patchSpans(doc, new Set(labels.keys()), (s) =>
    slugFor.has(s.id) ? { ...s, label: labels.get(s.id), slug: slugFor.get(s.id)! } : { ...s, label: labels.get(s.id) },
  )
}

/**
 * A grid segment starting on the downbeat at `time`. It carries on the tempo
 * and meter of the segment running there, else of the last one before; the
 * document's tempo and meter are the first default.
 */
function newSegmentAt(doc: StrataDocument, segs: GridSegment[], time: number): GridSegment {
  const running = segmentAt(segs, time, doc.duration)?.seg
  const before = [...segs].reverse().find((g) => g.start < time)
  const model = running ?? before
  const beatUnit = model?.beatUnit ?? doc.timeSignature?.denominator
  return {
    id: crypto.randomUUID(),
    start: time,
    bpm: model?.bpm ?? doc.bpm ?? 120,
    beatsPerBar: model?.beatsPerBar ?? doc.timeSignature?.numerator ?? 4,
    ...(beatUnit ? { beatUnit } : {}),
    // A split segment's own stopping point now belongs to the new one.
    ...(running?.end != null && running.end > time ? { end: running.end } : {}),
  }
}

/**
 * `next` with the boundary moves an edit made in `layerId` carried to linked
 * parent and child spans in other layers (lib/linkedBoundaries.ts).
 */
function withLinks(prev: StrataDocument, next: StrataDocument, layerId: string): StrataDocument {
  const before = prev.layers.find((l) => l.id === layerId)
  const after = next.layers.find((l) => l.id === layerId)
  if (!before || !after) return next
  return followLinks(next, layerId, boundaryMoves(segmentSpans(before), segmentSpans(after)))
}

/**
 * The document with a span's end moved by `delta(barLength, span)` seconds and
 * every later boundary in its layer with it (lib/spanEdit.ts, rippleSpanEnd),
 * the bar being the one the span ends in. Null when the span isn't on the grid
 * or nothing would change.
 */
function rippleByBars(
  doc: StrataDocument,
  layerId: string,
  spanId: string,
  delta: (barLen: number, span: Span) => number,
): StrataDocument | null {
  const layer = doc.layers.find((l) => l.id === layerId)
  const span = layer && segmentSpans(layer).find((x) => x.id === spanId)
  if (!layer || !span) return null
  const hit = segmentAt(sortedSegments(doc.beatGrid), Math.max(span.startTime, span.endTime - 1e-3), doc.duration)
  if (!hit) return null
  const next = rippleSpanEnd(segmentSpans(layer), spanId, delta(barLength(hit.seg), span), doc.duration)
  if (!next) return null
  const moved = withLinks(doc, { ...doc, layers: mapLayer(doc.layers, layerId, (l) => mapSegmentSpans(l, () => next)), updatedAt: now() }, layerId)
  // A span pushed past the layer's end is dropped.
  return afterRemoval(doc, moved)
}

/**
 * The tidy-up after an edit that may have removed spans: their commentary is
 * kept (re-anchored to a merged span or to their old times), and their
 * children are handed to the merged span or unlinked (lib/linkedBoundaries.ts).
 */
function afterRemoval(prev: StrataDocument, next: StrataDocument): StrataDocument {
  return repairParentLinks(reanchorOrphans(prev, next))
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
          updatedAt: now(),
        }
        set({ document: afterRemoval(doc, next) })
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
              mapSegmentSpans(l, (spans) =>
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
              mapSegmentSpans(l, (spans) =>
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
              mapSegmentSpans(l, (spans) =>
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

      extendToEnd: (layerId, spanId) => {
        const doc = get().document
        if (!doc) return
        let changed = false
        const layers = mapLayer(doc.layers, layerId, (l) =>
          mapSegmentSpans(l, (spans) => {
            const next = extendSpanToEnd(spans, spanId, doc.duration)
            if (!next) return spans
            changed = true
            return next
          }),
        )
        if (!changed) return
        // Removed spans' commentary survives, anchored to their old times.
        set({ document: afterRemoval(doc, { ...doc, layers, updatedAt: now() }) })
      },

      removeSpan: (layerId, spanId) => {
        const doc = get().document
        if (!doc) return
        const next = {
          ...doc,
          layers: mapLayer(doc.layers, layerId, (l) =>
            mapSegmentSpans(l, (spans) => spans.filter((s) => s.id !== spanId))
          ),
          updatedAt: now(),
        }
        // The span's commentary survives, anchored to the span's old times.
        set({ document: afterRemoval(doc, next) })
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
            mapSegmentSpans(l, (spans) =>
              [...spans.filter((s) => !spanIds.includes(s.id)), result].sort(
                (a, b) => a.startTime - b.startTime
              )
            )
          ),
          updatedAt: now(),
        }
        // The sources' commentary moves to the merged span (combined), and
        // so do their children.
        set({ document: afterRemoval(doc, next) })
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

      placeBoundary: (layerId, at) => {
        const doc = get().document
        if (!doc) return
        // Splitting a parent: a split near a boundary between its children
        // moves onto it, so no child straddles the split (lib/linkedBoundaries.ts).
        const target = doc.layers.find((l) => l.id === layerId)
        const parent = target && segmentSpans(target).find((x) => x.startTime < at && at < x.endTime)
        const time = parent ? splitTimeNearChildren(doc, parent, at) : at
        let changed = false
        const layers = mapLayer(doc.layers, layerId, (l) => {
          if (l.type !== 'segmentation') return l
          const data = l.data as SegmentationData
          // Layer.fillGaps false: a boundary in an empty stretch starts a span
          // that runs to the next boundary only, not back to the previous one.
          const next = placeBoundaryInSpans(
            data.spans,
            time,
            doc.duration,
            () => crypto.randomUUID(),
            l.fillGaps !== false,
          )
          if (!next) return l
          changed = true
          return { ...l, data: { ...data, spans: next } }
        })
        if (!changed) return
        let next: StrataDocument = { ...doc, layers, updatedAt: now() }
        // The left half keeps the span's id; its children under the new right
        // half move to it.
        if (parent) {
          const right = segmentSpans(next.layers.find((l) => l.id === layerId)!).find((x) => x.id !== parent.id && Math.abs(x.startTime - time) < 1e-9)
          if (right) next = relinkToPieces(next, parent.id, [parent.id, right.id])
        }
        // A split copies the label (and so the slug) into the new right half;
        // the original span keeps its slug and the new half gets the next free one.
        set({ document: resolveSlugCollisions(doc, next) })
      },

      endSpanAt: (layerId, time) => {
        const doc = get().document
        if (!doc) return
        let changed = false
        const layers = mapLayer(doc.layers, layerId, (l) => {
          if (l.type !== 'segmentation') return l
          const data = l.data as SegmentationData
          const next = endSpanAtTime(data.spans, time)
          if (!next) return l
          changed = true
          return { ...l, data: { ...data, spans: next } }
        })
        if (changed) set({ document: { ...doc, layers, updatedAt: now() } })
      },

      snapLayerToGrid: (layerId, unit) => {
        const doc = get().document
        if (!doc) return 0
        const segs = sortedSegments(doc.beatGrid)
        let moved = 0
        const layers = mapLayer(doc.layers, layerId, (l) => {
          if (l.type !== 'segmentation') return l
          const data = l.data as SegmentationData
          const r = snapSpansToGrid(data.spans, (t) => snapToGrid(t, segs, doc.duration, unit))
          moved = r.moved
          return moved ? { ...l, data: { ...data, spans: r.spans } } : l
        })
        if (moved) set({ document: withLinks(doc, { ...doc, layers, updatedAt: now() }, layerId) })
        return moved
      },

      fillLayerWithBars: (layerId, start, barsPer) => {
        const doc = get().document
        if (!doc) return 0
        let segs = sortedSegments(doc.beatGrid)
        if (!segmentAt(segs, start, doc.duration)) {
          if (doc.bpm == null) return 0
          segs = sortedSegments([...segs, newSegmentAt(doc, segs, start)])
        }
        const times = barTiling(segs, doc.duration, start, barsPer)
        if (times.length < 2) return 0
        const from = times[0]
        const to = times[times.length - 1]
        let made = 0
        const layers = mapLayer(doc.layers, layerId, (l) =>
          mapSegmentSpans(l, (spans) => {
            if (spans.some((x) => x.endTime > from + 1e-6 && x.startTime < to - 1e-6)) return spans
            const fresh: Span[] = times.slice(1).map((end, k) => ({ id: crypto.randomUUID(), startTime: times[k], endTime: end }))
            made = fresh.length
            return [...spans, ...fresh].sort((a, b) => a.startTime - b.startTime)
          }),
        )
        if (!made) return 0
        set({ document: { ...doc, beatGrid: segs, layers, updatedAt: now() } })
        return made
      },

      numberBars: (layerId, group) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer || layer.type !== 'segmentation' || layer.role !== 'bars' || segmentSpans(layer).length > 0) return 0
        const bars = numberedGridBars(sortedSegments(doc.beatGrid), doc.duration)
        if (!bars.length) return 0
        const counts = countRun(bars.length, group)
        const fresh: Span[] = bars.map((b, k) => ({ id: crypto.randomUUID(), startTime: b.start, endTime: b.end, hypermeter: counts[k] }))
        const filled = { ...doc, layers: mapLayer(doc.layers, layerId, (l) => mapSegmentSpans(l, () => fresh)) }
        const next = relabelSpans(filled, new Map(fresh.map((s, k) => [s.id, String(bars[k].bar)])), get().frozenSlugIds)
        set({ document: { ...next, updatedAt: now() } })
        return fresh.length
      },

      renumberSpans: (layerId, spanIds, group) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer) return
        const run = segmentSpans(layer).filter((s) => spanIds.includes(s.id)).sort((a, b) => a.startTime - b.startTime)
        if (!run.length) return
        const next = writeHypermeter(doc, run, countRun(run.length, group))
        if (next) set({ document: { ...next, updatedAt: now() } })
      },

      elideSpan: (layerId, spanId, group) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer) return
        const spans = [...segmentSpans(layer)].sort((a, b) => a.startTime - b.startTime)
        const at = spans.findIndex((s) => s.id === spanId)
        if (at < 0) return
        const after = elideCounts(spans.map((s) => s.hypermeter), at, group)
        const next = writeHypermeter(doc, spans.slice(at), after.slice(at))
        if (next) set({ document: { ...next, updatedAt: now() } })
      },

      setBarLayer: (layerId, on) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer || layer.type !== 'segmentation' || (layer.role === 'bars') === on) return
        let next: StrataDocument = { ...doc, layers: withBarRole(doc.layers, layerId, on) }
        const spans = [...segmentSpans(layer)].sort((a, b) => a.startTime - b.startTime)
        // Counts written as labels (before counts had a field of their own)
        // move into the hypermeter, and the labels become bar numbers. Labels
        // that are words stay.
        if (on && spans.length && spans.every((s) => !s.label?.trim() || parseHypermeter(s.label) !== null)) {
          if (spans.some((s) => s.label?.trim())) {
            const moved = new Set(spans.filter((s) => s.label?.trim() && !s.hypermeter).map((s) => s.id))
            next = patchSpans(next, moved, (s) => withHypermeter(s, parseHypermeter(s.label)))
          }
          const numbers = barNumberLabels(spans.length)
          next = relabelSpans(next, new Map(spans.map((s, k) => [s.id, numbers[k]])), get().frozenSlugIds)
        }
        set({ document: { ...next, updatedAt: now() } })
      },

      numberBarLayer: (layerId, first, spanIds) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer || layer.type !== 'segmentation') return
        const spans = [...segmentSpans(layer)]
          .filter((s) => !spanIds || spanIds.includes(s.id))
          .sort((a, b) => a.startTime - b.startTime)
        if (!spans.length) return
        const numbers = barNumberLabels(spans.length, first)
        const next = relabelSpans(doc, new Map(spans.map((s, k) => [s.id, numbers[k]])), get().frozenSlugIds)
        set({ document: { ...next, updatedAt: now() } })
      },

      countBars: (layerId, byLayerId, group, spanIds) => {
        const doc = get().document
        const layer = doc?.layers.find((l) => l.id === layerId)
        if (!doc || !layer || layer.type !== 'segmentation') return 0
        const spans = [...segmentSpans(layer)]
          .filter((s) => !spanIds || spanIds.includes(s.id))
          .sort((a, b) => a.startTime - b.startTime)
        if (!spans.length) return 0
        const by = byLayerId ? doc.layers.find((l) => l.id === byLayerId) : null
        const bars = spans.map((s): [number, number] => [s.startTime, s.endTime])
        const counts = by && by.type === 'segmentation'
          ? countsByGroups(bars, segmentSpans(by).map((g): [number, number] => [g.startTime, g.endTime]), group)
          : countRun(spans.length, group)
        const next = writeHypermeter(doc, spans, counts)
        if (next) set({ document: { ...next, updatedAt: now() } })
        return spans.length
      },

      elideGroupBoundary: (layerId, spanId) => {
        const doc = get().document
        const hit = doc && groupBoundaryOnBar(doc, layerId, spanId)
        if (!doc || !hit) return null
        // Elision is per boundary side (docs/decisions.md): the span that ends
        // in this bar marks its end elided, and its bracket runs on into the next.
        const next = patchSpans(doc, new Set([hit.boundary.before.id]), (s) => ({ ...s, endBoundaryType: 'elided', endCap: undefined }))
        set({ document: { ...next, updatedAt: now() } })
        return hit.layer.id
      },

      splitIntoBars: (spanIds, barsEach) => {
        const doc = get().document
        const picked = pickedOnOneLayer(doc, spanIds)
        if (!doc || !picked) return null
        const { layer: source, spans: phrases } = picked
        let layers = doc.layers
        // The bar layer is the analyst's to identify; this never makes one.
        const barLayer = layers.find((l) => l.role === 'bars' && l.id !== source.id && l.type === 'segmentation')
        if (!barLayer || barLayer.locked) return null
        const existing = segmentSpans(barLayer)
        if (phrases.some((p) => existing.some((b) => b.endTime > p.startTime + 1e-6 && b.startTime < p.endTime - 1e-6))) return 'occupied'
        // Bar numbers go on from the numbered bar before the first phrase.
        const before = segmentSpans(barLayer)
          .filter((b) => b.endTime <= phrases[0].startTime + 1e-6 && /^\s*\d+\s*$/.test(b.label ?? ''))
          .sort((a, b) => b.startTime - a.startTime)[0]
        let number = before ? Number(before.label) + 1 : 1
        const fresh: Span[] = phrases.flatMap((p) =>
          splitEvenly(p.startTime, p.endTime, barsEach).map(([startTime, endTime], k) => ({
            id: crypto.randomUUID(),
            startTime,
            endTime,
            parentId: p.id,
            hypermeter: { count: k + 1 },
          })),
        )
        layers = mapLayer(layers, barLayer.id, (l) => mapSegmentSpans(l, (spans) => [...spans, ...fresh].sort((a, b) => a.startTime - b.startTime)))
        const next = relabelSpans({ ...doc, layers }, new Map(fresh.map((b) => [b.id, String(number++)])), get().frozenSlugIds)
        set({ document: { ...next, updatedAt: now() } })
        return { made: fresh.length, layerId: barLayer.id }
      },

      phrasesFromCount: (spanIds) => {
        const doc = get().document
        const picked = pickedOnOneLayer(doc, spanIds)
        if (!doc || !picked) return null
        const { layer: source, spans: bars } = picked
        if (!bars.some((b) => placeOf(b.hypermeter) !== null)) return null
        const start = bars[0].startTime
        const end = bars[bars.length - 1].endTime
        let layers = doc.layers
        const above = layerAbove(layers, source)
        const free = above && !above.locked && !segmentSpans(above).some((x) => x.endTime > start + 1e-6 && x.startTime < end - 1e-6)
        let targetId: string
        if (above && free) targetId = above.id
        else {
          const at = source.displayOrder + 1
          const made = newSegmentLayer('Phrases', at)
          layers = [...layers.map((l) => (l.displayOrder >= at ? { ...l, displayOrder: l.displayOrder + 1 } : l)), made]
          targetId = made.id
        }
        const runs = phraseRuns(bars)
        const fresh: Span[] = runs.map((r) => ({ id: crypto.randomUUID(), startTime: r.start, endTime: r.end }))
        runs.forEach((r, k) => {
          if (r.elided && k > 0) fresh[k - 1] = { ...fresh[k - 1], endBoundaryType: 'elided' }
        })
        const parentOf = new Map(runs.flatMap((r, k) => r.ids.map((id) => [id, fresh[k].id] as const)))
        layers = mapLayer(layers, targetId, (l) => mapSegmentSpans(l, (spans) => [...spans, ...fresh].sort((a, b) => a.startTime - b.startTime)))
        layers = mapLayer(layers, source.id, (l) => mapSegmentSpans(l, (spans) => spans.map((x) => (parentOf.has(x.id) ? { ...x, parentId: parentOf.get(x.id) } : x))))
        set({ document: { ...doc, layers, updatedAt: now() } })
        return { made: fresh.length, layerId: targetId }
      },

      normalizeBars: (spanIds, mode, logLambda, intoNewLayer, flats) => {
        const doc = get().document
        const picked = pickedOnOneLayer(doc, spanIds)
        if (!doc || !picked || picked.spans.length < 2) return null
        const times = runTimes(picked.spans)
        if (!times) return null
        const plan = normalizePlan(times, mode, logLambda, flats)
        const run = picked.spans
        const placed = (s: Span, k: number): Span => ({ ...s, startTime: plan.times[k], endTime: plan.times[k + 1] })
        if (!intoNewLayer) {
          const at = new Map(run.map((s, k) => [s.id, k]))
          const layers = mapLayer(doc.layers, picked.layer.id, (l) =>
            mapSegmentSpans(l, (spans) => spans.map((s) => (at.has(s.id) ? placed(s, at.get(s.id)!) : s))),
          )
          set({ document: withLinks(doc, { ...doc, layers, updatedAt: now() }, picked.layer.id) })
          return { moved: plan.moved, layerId: picked.layer.id }
        }
        // A copy, normalized: only what names and counts the bars comes along.
        const name = `${picked.layer.label} (normalized)`
        const start = times[0]
        const end = times[times.length - 1]
        let layers = doc.layers
        let target = layers.find(
          (l) => l.type === 'segmentation' && l.label === name && !l.locked && !segmentSpans(l).some((x) => x.endTime > start + 1e-6 && x.startTime < end - 1e-6),
        )
        if (!target) {
          const at = picked.layer.displayOrder
          const made = newSegmentLayer(name, at)
          layers = [...layers.map((l) => (l.displayOrder >= at ? { ...l, displayOrder: l.displayOrder + 1 } : l)), made]
          target = made
        }
        const copies: Span[] = run.map((s, k) => {
          const c: Span = { id: crypto.randomUUID(), startTime: plan.times[k], endTime: plan.times[k + 1] }
          if (s.annotation != null) c.annotation = s.annotation
          if (s.hypermeter) c.hypermeter = s.hypermeter
          if (s.showHypermeter !== undefined) c.showHypermeter = s.showHypermeter
          if (s.type != null) c.type = s.type
          return c
        })
        layers = mapLayer(layers, target.id, (l) => mapSegmentSpans(l, (spans) => [...spans, ...copies].sort((a, b) => a.startTime - b.startTime)))
        const labelled = new Map(copies.map((c, k) => [c.id, run[k].label ?? null]).filter(([, label]) => label) as Array<[string, string]>)
        const next = relabelSpans({ ...doc, layers }, labelled, get().frozenSlugIds)
        set({ document: { ...next, updatedAt: now() } })
        return { moved: plan.moved, layerId: target.id }
      },

      addTempoWidget: () => {
        const doc = get().document
        if (!doc) return null
        const blocks = widgetBlocks(doc)
        const existing = doc.layers.find((l) => l.type === 'tempo')
        if (existing) {
          set({ document: { ...doc, widgets: setBlockHidden(blocks, 'tempo', false), updatedAt: now() } })
          return existing.id
        }
        const bars = doc.layers.find((l) => l.role === 'bars' && l.type === 'segmentation')
        if (!bars) return null
        const layer: TempoLayer = {
          ...newSegmentLayer('Tempo', 0),
          label: `${bars.label} tempo`,
          type: 'tempo',
          data: { source: { layerId: bars.id, unit: 'bar' } },
        }
        const layers = [...doc.layers, layer]
        set({ document: { ...doc, layers, widgets: widgetBlocks({ widgets: blocks, layers }), updatedAt: now() } })
        return layer.id
      },

      removeWidget: (type) => {
        const doc = get().document
        if (!doc || type === 'segmentation') return
        const layers = doc.layers.filter((l) => l.type !== type)
        set({ document: { ...doc, layers, widgets: widgetBlocks(doc).filter((w) => w.type !== type), updatedAt: now() } })
      },

      setWidgetHidden: (type, hidden) => {
        const doc = get().document
        if (!doc) return
        set({ document: { ...doc, widgets: setBlockHidden(widgetBlocks(doc), type, hidden), updatedAt: now() } })
      },

      moveWidget: (type, dir) => {
        const doc = get().document
        if (!doc) return
        const blocks = widgetBlocks(doc)
        const moved = moveBlock(blocks, type, dir)
        if (moved !== blocks) set({ document: { ...doc, widgets: moved, updatedAt: now() } })
      },

      setTempoDisplay: (layerId, display) => {
        const doc = get().document
        if (!doc) return
        const layers = doc.layers.map((l) => {
          if (l.id !== layerId || l.type !== 'tempo') return l
          const merged = { ...(l.data.display ?? {}), ...display }
          for (const k of Object.keys(merged) as Array<keyof typeof merged>) if (merged[k] === undefined) delete merged[k]
          return { ...l, data: { ...l.data, display: merged } }
        })
        set({ document: { ...doc, layers, updatedAt: now() } })
      },

      setTempoSource: (layerId, sourceId) => {
        const doc = get().document
        if (!doc) return
        const layers = doc.layers.map((l) =>
          l.id === layerId && l.type === 'tempo' ? { ...l, data: { ...l.data, source: { ...l.data.source, layerId: sourceId } } } : l,
        )
        set({ document: { ...doc, layers, updatedAt: now() } })
      },

      gridFromBars: (spanIds) => {
        const doc = get().document
        if (!doc) return null
        let bars: Span[]
        if (spanIds) {
          const picked = pickedOnOneLayer(doc, spanIds)
          if (!picked) return null
          bars = picked.spans
        } else {
          const layer = doc.layers.find((l) => l.role === 'bars' && l.type === 'segmentation')
          bars = layer ? [...segmentSpans(layer)].sort((a, b) => a.startTime - b.startTime) : []
        }
        if (!bars.length) return null
        const mkId = () => crypto.randomUUID()
        // Meters are read from the grid as it was, before it is replaced.
        const made = makeGridFromBars(bars, beatsPerBarAt(doc), mkId, doc.timeSignature?.denominator)
        if (!made.length) return null
        const from = bars[0].startTime
        const to = bars[bars.length - 1].endTime
        const beatGrid = spliceGrid(doc.beatGrid, made, from, to, doc.duration, mkId)
        set({ document: { ...doc, beatGrid, updatedAt: now() } })
        return { stretches: made.length, bars: bars.length }
      },

      resizeSpanByBars: (layerId, spanId, bars) => {
        const doc = get().document
        const next = doc && rippleByBars(doc, layerId, spanId, (barLen) => bars * barLen)
        if (next) set({ document: next })
      },

      setSpanBars: (layerId, spanId, bars) => {
        const doc = get().document
        const next = doc && rippleByBars(doc, layerId, spanId, (barLen, span) => bars * barLen - (span.endTime - span.startTime))
        if (next) set({ document: next })
      },

      groupSpans: (spanIds, target, fields = DEFAULT_COPY_FIELDS) => {
        const doc = get().document
        if (!doc) return null
        const picked = doc.layers.flatMap((l) => segmentSpans(l).filter((x) => spanIds.includes(x.id)).map((span) => ({ span, layer: l })))
        if (!picked.length) return null
        const sources = new Set(picked.map((p) => p.layer.id))
        const byOrder = picked.map((p) => p.layer).sort((a, b) => b.displayOrder - a.displayOrder)
        let layers = doc.layers
        let targetId: string
        if ('layerId' in target) {
          const t = doc.layers.find((l) => l.id === target.layerId)
          if (!t || t.type !== 'segmentation' || t.locked || sources.has(t.id)) return null
          targetId = t.id
        } else {
          // Made just above the highest source layer, or just below the
          // lowest; the layers from there up move up one.
          const at = target.below ? byOrder[byOrder.length - 1].displayOrder : byOrder[0].displayOrder + 1
          const made = newSegmentLayer(target.newLayer.trim() || 'New layer', at)
          layers = [...layers.map((l) => (l.displayOrder >= at ? { ...l, displayOrder: l.displayOrder + 1 } : l)), made]
          targetId = made.id
        }
        const start = Math.min(...picked.map((p) => p.span.startTime))
        const end = Math.max(...picked.map((p) => p.span.endTime))
        const id = crypto.randomUUID()
        const order = (layerId: string) => layers.find((l) => l.id === layerId)!.displayOrder
        let span: Span
        let parentOfSources = true
        if (picked.length === 1) {
          // Only the chosen parts (its slug resolved below), never its merge
          // record: the copy wasn't made by a merge. Copied up, it keeps the
          // original's own place in the hierarchy.
          const original = picked[0]
          span = copyOfSpan(original.span, id, fields)
          if (original.span.parentId != null) span.parentId = original.span.parentId
          if (order(targetId) < order(original.layer.id)) {
            // Copied down: the original, on the higher layer, is the parent.
            span.parentId = original.span.id
            parentOfSources = false
          }
        } else {
          // Several make a new, blank span over their stretch.
          span = { id, startTime: start, endTime: end }
        }
        const before = layers.find((l) => l.id === targetId)!
        layers = mapLayer(layers, targetId, (l) => mapSegmentSpans(l, (spans) => placeSpan(spans, span, () => crypto.randomUUID())))
        // Spans there that the new one cuts back (or cuts in two) keep the
        // children still under what is left of them, as a split does.
        const after = segmentSpans(layers.find((l) => l.id === targetId)!)
        const cut = segmentSpans(before).filter((x) => x.endTime > start && x.startTime < end && after.some((y) => y.id === x.id))
        const kept = new Set(segmentSpans(before).map((x) => x.id))
        // The new span is their parent, which ties their outer boundaries to
        // its edges (lib/linkedBoundaries.ts).
        if (parentOfSources)
          layers = layers.map((l) =>
            sources.has(l.id) ? mapSegmentSpans(l, (spans) => spans.map((x) => (spanIds.includes(x.id) ? { ...x, parentId: id } : x))) : l,
          )
        let next: StrataDocument = { ...doc, layers, updatedAt: now() }
        for (const x of cut) {
          const pieces = after.filter((y) => y.id === x.id || (!kept.has(y.id) && y.id !== id && y.startTime >= x.startTime && y.endTime <= x.endTime))
          next = relinkToPieces(next, x.id, pieces.map((y) => y.id))
        }
        // Replaced spans' commentary survives, anchored to their old times,
        // and their children are unlinked.
        next = afterRemoval(doc, next)
        const commentary = picked.length === 1 && fields.includes('commentary') ? blockForSpan(doc, picked[0].span.id)?.text : undefined
        if (commentary) next = withSpanCommentary(next, id, commentary, () => crypto.randomUUID())
        set({ document: resolveSlugCollisions(doc, next) })
        return id
      },

      groupIntoLayerAbove: (spanIds) => {
        const doc = get().document
        if (!doc) return null
        const { above, blocked } = groupUpTarget(doc, spanIds)
        if (blocked) return null
        const count = doc.layers.filter((l) => l.type === 'segmentation').length
        return get().groupSpans(spanIds, above ? { layerId: above.id } : { newLayer: `Layer ${count + 1}` })
      },

      setSpanEdge: (layerId, spanId, edge, time) => {
        const doc = get().document
        if (!doc) return
        const next = {
          ...doc,
          layers: mapLayer(doc.layers, layerId, (l) =>
            mapSegmentSpans(l, (spans) => setSpanEdge(spans, spanId, edge, time, doc.duration) ?? spans),
          ),
          updatedAt: now(),
        }
        set({ document: withLinks(doc, next, layerId) })
      },

      setAdjacentBoundary: (layerId, leftSpanId, rightSpanId, time, minWidth) => {
        const doc = get().document
        if (!doc) return
        const gap = Math.max(MIN_SPAN_WIDTH, minWidth ?? MIN_SPAN_WIDTH)
        const next = {
          ...doc,
          layers: mapLayer(doc.layers, layerId, (l) =>
            mapSegmentSpans(l, (spans) => {
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
        }
        set({ document: withLinks(doc, next, layerId) })
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

      importVocabPack: (pack) => {
        const doc = get().document
        if (!doc) return null
        const result = mergeVocabPack(doc.vocabulary, pack)
        if (result.added || result.updated)
          set({ document: { ...doc, vocabulary: result.vocabulary, updatedAt: now() } })
        return result
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
        set({ document: { ...doc, beatGrid: sortedSegments([...segs, newSegmentAt(doc, segs, time)]), updatedAt: now() } })
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
            ...doc.layers.flatMap(segmentSpans).flatMap((s) => [s.startTime, s.endTime]).filter((t) => t <= tappedStart + 0.05),
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

      stepGridTempo: (time, deltaBpm) => {
        const doc = get().document
        const seg = doc && segmentForAdjusting(sortedSegments(doc.beatGrid), time, doc.duration)
        if (!seg) return
        get().updateGridSegment(seg.id, { bpm: Math.max(1, roundTempo(seg.bpm + deltaBpm)) })
      },

      nudgeGrid: (time, seconds) => {
        const doc = get().document
        if (!doc) return
        const segs = sortedSegments(doc.beatGrid)
        const seg = segmentForAdjusting(segs, time, doc.duration)
        if (!seg) return
        // Not before 0:00, and not onto the row before it.
        const before = segs[segs.indexOf(seg) - 1]
        const floor = before ? before.start + 0.05 : 0
        const start = Math.max(floor, Math.round((seg.start + seconds) * 1000) / 1000)
        if (start !== seg.start) get().updateGridSegment(seg.id, { start })
      },

      pinDownbeat: (time) => {
        const doc = get().document
        const seg = doc && segmentForAdjusting(sortedSegments(doc.beatGrid), time, doc.duration)
        if (!seg) return null
        const bpm = tempoThroughDownbeat(seg, time)
        if (bpm == null) return null
        get().updateGridSegment(seg.id, { bpm })
        return { bpm, bars: Math.round(((time - seg.start) * bpm) / (seg.beatsPerBar * 60)) }
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
