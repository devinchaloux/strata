/**
 * Pure merge logic — no React, no store. Unit-tested in isolation.
 *
 * Two jobs:
 *   1. Eligibility — given a selection, can it be merged? (2+, same layer,
 *      consecutive). See `mergeEligibility`.
 *   2. Resolution — collapse N spans into one, auto-resolving the additive /
 *      pessimistic fields and surfacing genuinely-competing fields as conflicts
 *      for the dialog. See `resolveMerge` and `finalizeMerge`.
 *
 * Field rules (mirrors docs/decisions.md "Merge" + the Phase 2.5 extensions for
 * the fillColor/strokeColor split, annotation, lyrics, boundary types, caps):
 *
 *   label, type            lone value wins; 2+ distinct non-null → conflict
 *   shortLabel, annotation lone value wins; 2+ distinct non-null → conflict
 *   fillColor, strokeColor each independent; lone override wins; 2+ distinct → conflict
 *   parentId               all same → keep; differ → conflict (incl. "None")
 *   notes, lyrics          concatenate non-null with `\n\n---\n\n`
 *   confidence             lowest of the selection (speculative > approximate > definite)
 *   startBoundaryType      first span's (earliest startTime)
 *   endBoundaryType        last span's (latest endTime)
 *   startCap / lineStyle   first span's (outer face / whole-shape style)
 *   endCap                 last span's (outer face)
 *   startTime / endTime    min / max across the selection
 *   slug                   regenerated from the resolved label
 *   mergedFrom             all source ids in startTime order
 */

import type { Span, ConfidenceLevel } from '@/types/strata'
import { slugify } from '@/lib/slug'

export const NOTE_SEPARATOR = '\n\n---\n\n'

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type MergeEligibility =
  | { ok: true; layerId: string; spans: Span[] }
  | { ok: false; reason: string }

/**
 * Decide whether a selection can be merged. `layersById` maps each selected
 * span id to the id of the layer that owns it; `layerSpans` is a lookup from a
 * layer id to that layer's full span list (any order — sorted here).
 *
 * Merge requires: 2+ spans, all in the same layer, and consecutive within that
 * layer (no unselected span sits between the first and last selected one).
 */
export function mergeEligibility(
  selectedIds: string[],
  layerOf: (spanId: string) => string | undefined,
  layerSpans: (layerId: string) => Span[],
): MergeEligibility {
  if (selectedIds.length < 2) {
    return { ok: false, reason: 'Select 2 or more consecutive spans in the same layer to merge.' }
  }

  // All in one layer?
  const layerIds = new Set<string>()
  for (const id of selectedIds) {
    const l = layerOf(id)
    if (l) layerIds.add(l)
  }
  if (layerIds.size !== 1) {
    return { ok: false, reason: 'Select 2 or more consecutive spans in the same layer to merge.' }
  }
  const layerId = [...layerIds][0]

  // Consecutive within that layer? Find the selected spans' indices in the
  // layer's startTime-sorted order; they must form a gapless run.
  const sorted = [...layerSpans(layerId)].sort((a, b) => a.startTime - b.startTime)
  const selectedSet = new Set(selectedIds)
  const indices = sorted
    .map((s, i) => (selectedSet.has(s.id) ? i : -1))
    .filter((i) => i >= 0)
  if (indices.length !== selectedIds.length) {
    // A selected id wasn't found in the layer — defensive; treat as ineligible.
    return { ok: false, reason: 'Select 2 or more consecutive spans in the same layer to merge.' }
  }
  const contiguous = indices[indices.length - 1] - indices[0] === indices.length - 1
  if (!contiguous) {
    return { ok: false, reason: 'Selected spans must be consecutive (no gaps) to merge.' }
  }

  const spans = indices.map((i) => sorted[i])
  return { ok: true, layerId, spans }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type ConflictField =
  | 'label'
  | 'shortLabel'
  | 'type'
  | 'annotation'
  | 'fillColor'
  | 'strokeColor'
  | 'parentId'

export interface MergeConflict {
  field: ConflictField
  /**
   * Distinct candidate values, in first-seen order. `null` appears as an
   * explicit option only for color (= "layer default") and parentId (= "None"),
   * and only when at least one selected span carries that null.
   */
  options: (string | null)[]
}

export interface MergeResolution {
  /**
   * The merged span with every AUTO-resolved field filled in. Conflict fields
   * carry a provisional value (the first candidate) so the object is always a
   * valid Span; the dialog overwrites them via `finalizeMerge`.
   */
  draft: Span
  /** Fields needing a human choice. Empty → merge immediately, no dialog. */
  conflicts: MergeConflict[]
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = {
  definite: 0,
  approximate: 1,
  speculative: 2,
}

/** Distinct non-null values of a field across spans, in first-seen order. */
function distinct<T>(values: (T | null | undefined)[]): T[] {
  const out: T[] = []
  for (const v of values) {
    if (v == null) continue
    if (!out.includes(v)) out.push(v)
  }
  return out
}

/** Concatenate non-empty strings with the note separator (null if none). */
function concatText(values: (string | null | undefined)[]): string | null {
  const parts = values.map((v) => v?.trim()).filter((v): v is string => !!v)
  return parts.length ? parts.join(NOTE_SEPARATOR) : null
}

/**
 * Build the merged span and the list of conflicts. `spans` must be the spans to
 * merge (will be sorted here by startTime). `mkId` generates the new UUID.
 */
export function resolveMerge(spans: Span[], mkId: () => string): MergeResolution {
  const sorted = [...spans].sort((a, b) => a.startTime - b.startTime)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const conflicts: MergeConflict[] = []

  // --- Single-value-wins / conflict fields ---

  const labels = distinct(sorted.map((s) => s.label))
  if (labels.length > 1) conflicts.push({ field: 'label', options: labels })

  const shortLabels = distinct(sorted.map((s) => s.shortLabel))
  if (shortLabels.length > 1) conflicts.push({ field: 'shortLabel', options: shortLabels })

  const types = distinct(sorted.map((s) => s.type))
  if (types.length > 1) conflicts.push({ field: 'type', options: types })

  const annotations = distinct(sorted.map((s) => s.annotation))
  if (annotations.length > 1) conflicts.push({ field: 'annotation', options: annotations })

  // Colors: a lone override wins; competing overrides conflict. "Layer default"
  // (null) is offered as an option only when some span has no override.
  const fills = distinct(sorted.map((s) => s.fillColor))
  const fillHasNull = sorted.some((s) => s.fillColor == null)
  if (fills.length > 1) {
    conflicts.push({ field: 'fillColor', options: fillHasNull ? [...fills, null] : fills })
  }
  const strokes = distinct(sorted.map((s) => s.strokeColor))
  const strokeHasNull = sorted.some((s) => s.strokeColor == null)
  if (strokes.length > 1) {
    conflicts.push({ field: 'strokeColor', options: strokeHasNull ? [...strokes, null] : strokes })
  }

  // parentId: all same (incl. all null) → keep; otherwise conflict. Unlike
  // color, a lone parent against a null IS a conflict (spec edge case), so null
  // counts as a distinct value here. "None" is offered when some span has no
  // parent.
  const parents = distinct(sorted.map((s) => s.parentId))
  const parentHasNull = sorted.some((s) => s.parentId == null)
  const parentDistinctCount = parents.length + (parentHasNull ? 1 : 0)
  if (parentDistinctCount > 1) {
    conflicts.push({ field: 'parentId', options: parentHasNull ? [...parents, null] : parents })
  }

  // --- Auto-resolved fields ---

  // Lowest confidence present; omit (undefined) when everything is definite so
  // the merged span keeps the implicit "definite" default rather than storing it.
  let confidence: ConfidenceLevel | undefined
  let worst = 0
  for (const s of sorted) {
    const rank = CONFIDENCE_RANK[s.confidence ?? 'definite']
    if (rank > worst) {
      worst = rank
      confidence = s.confidence
    }
  }

  // A conflict field's provisional value is the field's first candidate; a
  // non-conflict field takes its lone value (or null).
  const label = labels[0] ?? null
  const shortLabel = shortLabels[0] ?? null
  const type = types[0] ?? null
  const annotation = annotations[0] ?? null
  const fillColor = fills[0] ?? null
  const strokeColor = strokes[0] ?? null
  const parentId = parents[0] ?? null

  const draft: Span = {
    id: mkId(),
    startTime: first.startTime,
    endTime: last.endTime,
    label,
    shortLabel,
    slug: label ? slugify(label) : null,
    type,
    fillColor,
    strokeColor,
    annotation,
    notes: concatText(sorted.map((s) => s.notes)),
    lyrics: concatText(sorted.map((s) => s.lyrics)),
    confidence,
    startBoundaryType: first.startBoundaryType ?? null,
    endBoundaryType: last.endBoundaryType ?? null,
    parentId,
    startCap: first.startCap,
    endCap: last.endCap,
    lineStyle: first.lineStyle,
    mergedFrom: sorted.map((s) => s.id),
  }

  return { draft, conflicts }
}

/**
 * Apply the analyst's conflict choices to the draft, producing the final span.
 * `choices` maps each conflict field to the chosen value. Label changes
 * re-derive the slug. Unlisted fields keep the draft's provisional value.
 */
export function finalizeMerge(
  draft: Span,
  choices: Partial<Record<ConflictField, string | null>>,
): Span {
  const final: Span = { ...draft }
  for (const [field, value] of Object.entries(choices) as [ConflictField, string | null][]) {
    if (field === 'label') {
      final.label = value
      final.slug = value ? slugify(value) : null
    } else {
      // fillColor | strokeColor | type | annotation | parentId
      final[field] = value
    }
  }
  return final
}
