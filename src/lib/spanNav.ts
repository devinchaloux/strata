/**
 * Keyboard navigation between spans. Pure functions: the keyboard handler in
 * App decides what a key means and applies the result.
 *
 *   ← →   previous / next span in the same layer, in time order
 *   ↑ ↓   the span in the layer above / below that overlaps this one's middle
 *         (or the nearest one), skipping hidden and empty layers
 */
import type { Layer, Span, StrataDocument } from '@/types/strata'
import { formSpans } from './layers'

export type NavDirection = 'left' | 'right' | 'up' | 'down'

/** Visible form layers from the top of the stack down. */
function layersTopDown(doc: StrataDocument): Layer[] {
  return doc.layers
    .filter((l) => l.type === 'form-diagram' && l.visibility && formSpans(l).length > 0)
    .sort((a, b) => b.displayOrder - a.displayOrder)
}

const byTime = (spans: Span[]) => [...spans].sort((a, b) => a.startTime - b.startTime)

/** The span a move from `spanId` in `dir` lands on, or null at an edge. */
export function spanNeighbour(doc: StrataDocument, spanId: string, dir: NavDirection): string | null {
  const layers = layersTopDown(doc)
  const li = layers.findIndex((l) => formSpans(l).some((s) => s.id === spanId))
  if (li < 0) return null
  const spans = byTime(formSpans(layers[li]))
  const i = spans.findIndex((s) => s.id === spanId)
  if (dir === 'left') return spans[i - 1]?.id ?? null
  if (dir === 'right') return spans[i + 1]?.id ?? null

  const target = layers[dir === 'up' ? li - 1 : li + 1]
  if (!target) return null
  const mid = (spans[i].startTime + spans[i].endTime) / 2
  const candidates = byTime(formSpans(target))
  const hit = candidates.find((s) => mid >= s.startTime && mid < s.endTime)
  if (hit) return hit.id
  // A gap in the target layer: the nearest span to the middle.
  let best: Span | null = null
  let bestDistance = Infinity
  for (const s of candidates) {
    const d = mid < s.startTime ? s.startTime - mid : mid - s.endTime
    if (d < bestDistance) {
      bestDistance = d
      best = s
    }
  }
  return best?.id ?? null
}

/** Where navigation starts with nothing selected: the first span of the given layer, else of the top layer. */
export function firstSpan(doc: StrataDocument, layerId: string | null): string | null {
  const layers = layersTopDown(doc)
  const layer = layers.find((l) => l.id === layerId) ?? layers[0]
  return layer ? (byTime(formSpans(layer))[0]?.id ?? null) : null
}

/** The spans from `anchorId` to `toId` inclusive, in time order, if both are in one layer. */
export function spanRange(doc: StrataDocument, anchorId: string, toId: string): string[] | null {
  for (const l of doc.layers) {
    const spans = byTime(formSpans(l))
    const a = spans.findIndex((s) => s.id === anchorId)
    const b = spans.findIndex((s) => s.id === toId)
    if (a >= 0 && b >= 0) return spans.slice(Math.min(a, b), Math.max(a, b) + 1).map((s) => s.id)
  }
  return null
}
