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
 * Where the one-click Group into the layer above would go: the layer just
 * above the selection's highest layer, or a new one if there is none (or it
 * is locked). Blocked when that layer already has spans in the stretch: the
 * one-click action never cuts or replaces, which is left to Group into… and
 * Copy to layer…, where the effect is shown first.
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

/**
 * The parts of a span Copy to layer can take along; the analyst picks them in
 * its picker, and the choice is remembered in the browser. Lyrics, notes and
 * commentary start off: copied, they would show twice at the same moment.
 * docs/decisions.md, "Choosing What Copy to Layer Takes".
 */
export type CopyField = 'label' | 'type' | 'annotation' | 'keyArea' | 'colours' | 'pattern' | 'shape' | 'lyrics' | 'notes' | 'commentary'

export const COPY_FIELDS: { id: CopyField; name: string }[] = [
  { id: 'label', name: 'Label' },
  { id: 'type', name: 'Type' },
  { id: 'annotation', name: 'Annotation' },
  { id: 'keyArea', name: 'Key area' },
  { id: 'colours', name: 'Colours' },
  { id: 'pattern', name: 'Pattern' },
  { id: 'shape', name: 'Shape and line' },
  { id: 'lyrics', name: 'Lyrics' },
  { id: 'notes', name: 'Notes' },
  { id: 'commentary', name: 'Commentary' },
]

export const DEFAULT_COPY_FIELDS: CopyField[] = ['label', 'type', 'annotation', 'keyArea', 'colours', 'pattern', 'shape']

/** The span fields each copy choice carries (commentary is copied by the store, its own way). */
const COPY_KEYS: Record<Exclude<CopyField, 'commentary'>, (keyof Span)[]> = {
  label: ['label', 'shortLabel', 'slug'],
  type: ['type'],
  annotation: ['annotation'],
  keyArea: ['keyArea'],
  colours: ['fillColor', 'strokeColor'],
  pattern: ['fillPattern'],
  shape: ['startCap', 'endCap', 'startBoundaryType', 'endBoundaryType', 'lineStyle', 'endOnTop'],
  lyrics: ['lyrics'],
  notes: ['notes'],
}

/**
 * A copy of `span` under `id`: its times, and only the chosen parts. Never its
 * merge record or parent link; the store sets the link for the layer it goes to.
 */
export function copyOfSpan(span: Span, id: string, fields: CopyField[]): Span {
  const copy: Span = { id, startTime: span.startTime, endTime: span.endTime }
  for (const field of fields) {
    if (field === 'commentary') continue
    for (const key of COPY_KEYS[field]) if (span[key] !== undefined) (copy as unknown as Record<string, unknown>)[key] = span[key]
  }
  return copy
}
