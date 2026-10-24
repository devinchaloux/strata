/**
 * Grouping: spans in one layer gathered into a single span on another layer
 * (several spans), or a span copied there (one). docs/decisions.md, "Group
 * Spans Into Another Layer".
 *
 * The target layer may already have spans in that stretch. Layers never
 * overlap within themselves, so the new span takes its stretch: a span inside
 * it is replaced, and one crossing either edge is cut back to the edge, as a
 * split would cut it. The picker previews this (groupPreview) before anything
 * changes.
 */
import type { Layer, Span, StrataDocument } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { MIN_SPAN_WIDTH } from '@/lib/spanEdit'

export interface GroupPreview {
  /** Spans in the target that the new span replaces outright. */
  replaced: number
  /** Spans in the target cut back at the new span's edges. */
  cut: number
}

const overlaps = (s: Span, start: number, end: number) => s.endTime > start + 1e-6 && s.startTime < end - 1e-6

/** What placing a span over [start, end] would do to a layer's spans. */
export function groupPreview(spans: Span[], start: number, end: number): GroupPreview {
  let replaced = 0
  let cut = 0
  for (const s of spans) {
    if (!overlaps(s, start, end)) continue
    const keepsLeft = start - s.startTime >= MIN_SPAN_WIDTH
    const keepsRight = s.endTime - end >= MIN_SPAN_WIDTH
    if (keepsLeft || keepsRight) cut++
    else replaced++
  }
  return { replaced, cut }
}

/**
 * A layer's spans with `span` placed in them: spans inside its stretch are
 * removed, and one crossing an edge keeps the part outside, cut cleanly at the
 * edge (an elided end there becomes a plain one). A span crossing both edges
 * leaves a piece on each side, the right piece with a new id.
 */
export function placeSpan(spans: Span[], span: Span, mkId: () => string): Span[] {
  const { startTime: start, endTime: end } = span
  const out: Span[] = []
  for (const s of spans) {
    if (!overlaps(s, start, end)) {
      out.push(s)
      continue
    }
    const left = start - s.startTime >= MIN_SPAN_WIDTH
    const right = s.endTime - end >= MIN_SPAN_WIDTH
    if (left)
      out.push({
        ...s,
        endTime: start,
        endBoundaryType: 'definite',
        endCap: s.endCap === 'elision' ? undefined : s.endCap,
        endOnTop: undefined,
      })
    if (right)
      out.push({
        ...s,
        id: left ? mkId() : s.id,
        startTime: end,
        startBoundaryType: 'definite',
        startCap: s.startCap === 'elision' ? undefined : s.startCap,
      })
  }
  return [...out, span].sort((a, b) => a.startTime - b.startTime)
}

/** The form layer drawn just above `layer` (the next higher displayOrder), if any. */
export function layerAbove(layers: Layer[], layer: Layer): Layer | null {
  return (
    layers
      .filter((l) => l.type === 'form-diagram' && l.displayOrder > layer.displayOrder)
      .sort((a, b) => a.displayOrder - b.displayOrder)[0] ?? null
  )
}

/**
 * Where the one-click actions (Copy up, Group into the layer above) would
 * go: the layer just above the selection's highest layer, or a new one if
 * there is none (or it is locked). Blocked when that layer already has spans
 * in the stretch: the one-click actions never cut or replace, which is left
 * to Group into…, where the effect is shown first.
 */
export function groupUpTarget(doc: StrataDocument, spanIds: string[]): { above: Layer | null; blocked: string | null } {
  const picked = doc.layers.flatMap((l) => formSpans(l).filter((s) => spanIds.includes(s.id)))
  const top = doc.layers.filter((l) => formSpans(l).some((s) => spanIds.includes(s.id))).sort((a, b) => b.displayOrder - a.displayOrder)[0]
  if (!top || !picked.length) return { above: null, blocked: 'Nothing selected' }
  const found = layerAbove(doc.layers, top)
  const above = found && !found.locked ? found : null
  if (!above) return { above: null, blocked: null }
  const start = Math.min(...picked.map((s) => s.startTime))
  const end = Math.max(...picked.map((s) => s.endTime))
  const p = groupPreview(formSpans(above), start, end)
  return {
    above,
    blocked: p.replaced || p.cut ? `${above.label} already has a span here. Use Group into… to replace it.` : null,
  }
}
