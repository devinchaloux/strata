/**
 * useMerge — the single merge entry path shared by every trigger (toolbar
 * button, Ctrl+J, context-menu/metadata Merge ←/→).
 *
 * Exposes:
 *   - `eligibility` for the CURRENT selection (drives button enable/disable +
 *     tooltip).
 *   - `performMerge(ids?)` which resolves the merge and either commits it
 *     immediately (no conflicts) or opens the conflict dialog.
 *   - `neighborId(spanId, dir)` to find the previous/next span in a span's layer,
 *     for the single-span "Merge ← / → Merge" actions.
 *
 * All merge field logic lives in lib/mergeSpans (pure, unit-tested); this hook
 * is only the wiring between selection state, the document store, and the dialog.
 */

import { useMemo } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { mergeEligibility, resolveMerge, type MergeEligibility } from '@/lib/mergeSpans'
import type { FormDiagramData, Layer, Span } from '@/types/strata'

/** Spans of a layer (empty for non-form-diagram layers). */
function spansOf(layer: Layer): Span[] {
  return layer.type === 'form-diagram' ? (layer.data as FormDiagramData).spans : []
}

export function useMerge() {
  const doc = useDocumentStore((s) => s.document)
  const mergeSpansAction = useDocumentStore((s) => s.mergeSpans)
  const selectedSpanIds = useUIStore((s) => s.selectedSpanIds)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const openMergeDialog = useUIStore((s) => s.openMergeDialog)

  const layers = doc?.layers ?? []

  // Map a span id to its owning layer id, and a layer id to its spans.
  const layerOf = (spanId: string): string | undefined =>
    layers.find((l) => spansOf(l).some((s) => s.id === spanId))?.id
  const layerSpans = (layerId: string): Span[] => {
    const l = layers.find((x) => x.id === layerId)
    return l ? spansOf(l) : []
  }

  const eligibility: MergeEligibility = useMemo(
    () => mergeEligibility(selectedSpanIds, layerOf, layerSpans),
    // Recompute when selection or the document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSpanIds, doc],
  )

  /** Resolve and either commit immediately or open the conflict dialog. */
  function performMerge(ids: string[] = selectedSpanIds) {
    const elig = mergeEligibility(ids, layerOf, layerSpans)
    if (!elig.ok) return
    const sourceIds = elig.spans.map((s) => s.id)
    const { draft, conflicts } = resolveMerge(elig.spans, () => crypto.randomUUID())
    if (conflicts.length === 0) {
      mergeSpansAction(elig.layerId, sourceIds, draft)
      selectSpan(draft.id)
    } else {
      openMergeDialog({ layerId: elig.layerId, sourceIds, draft, conflicts })
    }
  }

  /** The id of the previous / next span in this span's layer (null at the ends). */
  function neighborId(spanId: string, dir: 'prev' | 'next'): string | null {
    const layerId = layerOf(spanId)
    if (!layerId) return null
    const sorted = [...layerSpans(layerId)].sort((a, b) => a.startTime - b.startTime)
    const i = sorted.findIndex((s) => s.id === spanId)
    if (i === -1) return null
    const j = dir === 'prev' ? i - 1 : i + 1
    return sorted[j]?.id ?? null
  }

  return { eligibility, performMerge, neighborId }
}
