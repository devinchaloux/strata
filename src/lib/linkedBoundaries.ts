/**
 * Linked boundaries between a parent span and its children (Span.parentId),
 * which Group and Copy to layer set. When a boundary moves in one layer (a drag, a
 * typed time, Fit to the grid, a change of length in bars) and it is where a
 * parent and its child meet, the boundary at the same moment in the other
 * layer moves with it, neighbours included, and on through any further
 * levels (phrases → sections → rotations). A child's inner boundaries aren't
 * its parent's edges, so they move alone. Splitting or merging moves no
 * boundary, so it moves nothing here; a merged or deleted parent's children
 * are re-pointed or unlinked by repairParentLinks. Unlinking clears parentId.
 * docs/decisions.md, "Group Spans Into Another Layer".
 */
import type { StrataDocument, Span } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { findOverlaps, MIN_SPAN_WIDTH } from '@/lib/spanEdit'

const EPS = 1e-6
const at = (a: number, b: number) => Math.abs(a - b) < EPS

/** A boundary that moved: [from, to]. */
export type Move = [number, number]

/** The boundaries an edit moved in one layer: span edges that changed, by span id. */
export function boundaryMoves(prev: Span[], next: Span[]): Move[] {
  const before = new Map(prev.map((s) => [s.id, s]))
  const out = new Map<number, number>()
  for (const s of next) {
    const p = before.get(s.id)
    if (!p) continue
    if (!at(p.startTime, s.startTime)) out.set(p.startTime, s.startTime)
    if (!at(p.endTime, s.endTime)) out.set(p.endTime, s.endTime)
  }
  return [...out]
}

/**
 * Move every edge at a moved boundary's old time to its new time, all at
 * once. Null if nothing is at those times, or the result would squeeze a span
 * below the minimum width or make two overlap (the layer is then left alone).
 */
export function applyMoves(spans: Span[], moves: Move[]): Span[] | null {
  const to = (t: number) => moves.find(([from]) => at(from, t))?.[1]
  let changed = false
  const next = spans.map((s) => {
    const a = to(s.startTime)
    const b = to(s.endTime)
    if (a === undefined && b === undefined) return s
    changed = true
    return { ...s, startTime: a ?? s.startTime, endTime: b ?? s.endTime }
  })
  if (!changed) return null
  if (next.some((s) => s.endTime - s.startTime < MIN_SPAN_WIDTH - EPS) || findOverlaps(next).length) return null
  return next
}

const hasEdgeAt = (s: Span, t: number) => at(s.startTime, t) || at(s.endTime, t)

/**
 * Carry boundary moves made in `layerId` through every link, layer by layer.
 * A move crosses to another layer when a parent and child, one in each,
 * share it: the one here has an edge where the boundary now is, and the one
 * there an edge where it was.
 */
export function followLinks(doc: StrataDocument, layerId: string, moves: Move[]): StrataDocument {
  if (!moves.length) return doc
  let layers = doc.layers
  const done = new Set([layerId])
  const queue: [string, Move[]][] = [[layerId, moves]]
  while (queue.length) {
    const [fromId, fromMoves] = queue.shift()!
    const from = layers.find((l) => l.id === fromId)
    if (!from) continue
    for (const other of layers) {
      if (done.has(other.id) || other.type !== 'form-diagram') continue
      const there = formSpans(other)
      const pairs = formSpans(from).flatMap((x) =>
        there.filter((y) => x.parentId === y.id || y.parentId === x.id).map((y) => [x, y] as const),
      )
      if (!pairs.length) continue
      const crossing = fromMoves.filter(([old, now]) => pairs.some(([x, y]) => hasEdgeAt(x, now) && hasEdgeAt(y, old)))
      if (!crossing.length) continue
      const next = applyMoves(formSpans(other), crossing)
      if (!next) continue
      done.add(other.id)
      layers = layers.map((l) => (l.id === other.id && l.type === 'form-diagram' ? { ...l, data: { ...l.data, spans: next } } : l))
      queue.push([other.id, crossing])
    }
  }
  return layers === doc.layers ? doc : { ...doc, layers }
}

/**
 * Children whose parent is gone after an edit. A parent merged into a larger
 * span hands its children to that span (found through the merged span's
 * mergedFrom); a parent deleted outright, removed by another edit or taken
 * with its layer unlinks them, clearing parentId. Returns `doc` unchanged
 * when every link still resolves. docs/decisions.md, "Schema Review: Three
 * Fields Cut".
 */
export function repairParentLinks(doc: StrataDocument): StrataDocument {
  const spans = doc.layers.flatMap((l) => formSpans(l))
  const live = new Set(spans.map((s) => s.id))
  if (!spans.some((s) => s.parentId && !live.has(s.parentId))) return doc
  const heirOf = new Map<string, string>()
  for (const s of spans) for (const src of s.mergedFrom ?? []) heirOf.set(src, s.id)
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.type === 'form-diagram' && l.data.spans.some((s) => s.parentId && !live.has(s.parentId))
        ? {
            ...l,
            data: {
              ...l.data,
              spans: l.data.spans.map((s) =>
                s.parentId && !live.has(s.parentId) ? { ...s, parentId: heirOf.get(s.parentId) ?? null } : s,
              ),
            },
          }
        : l,
    ),
  }
}
