/**
 * Linked boundaries between a parent span and its children (Span.parentId),
 * which Group and Copy to layer set. When a boundary moves in one layer (a drag, a
 * typed time, Fit to the grid, a change of length in bars) and it is where a
 * parent and its child meet, the boundary at the same moment in the other
 * layer moves with it, neighbours included, and on through any further
 * levels (phrases → sections → rotations). A child's inner boundaries aren't
 * its parent's edges, so they move alone. Splitting or merging moves no
 * boundary, so it moves nothing here; a split parent's children go to the
 * half that holds most of them (relinkToPieces), and a merged or deleted
 * parent's are re-pointed or unlinked by repairParentLinks. Unlinking clears
 * parentId.
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

/**
 * How near a split must fall to a child's boundary to move onto it: half a
 * second, about the slack in pressing B by ear. docs/decisions.md, "Splitting
 * a Parent".
 */
export const SPLIT_SNAP_SEC = 0.5

/**
 * Where to split `parent` when the analyst splits it at `time`: the nearest
 * boundary between its children, if one is within SPLIT_SNAP_SEC, so no child
 * is left straddling the split; otherwise `time` itself.
 */
export function splitTimeNearChildren(doc: StrataDocument, parent: Span, time: number): number {
  const edges = doc.layers
    .flatMap((l) => formSpans(l))
    .filter((s) => s.parentId === parent.id)
    .flatMap((s) => [s.startTime, s.endTime])
    .filter((t) => t > parent.startTime + EPS && t < parent.endTime - EPS)
  let best = time
  let bestDist = SPLIT_SNAP_SEC + EPS
  for (const t of edges) {
    const d = Math.abs(t - time)
    if (d < bestDist) {
      best = t
      bestDist = d
    }
  }
  return best
}

/**
 * After `parentId` was split or cut into `pieceIds` (the first keeping its id),
 * each of its children links to the piece that overlaps it most (the earlier
 * piece on a tie), or is unlinked if none overlaps it.
 */
export function relinkToPieces(doc: StrataDocument, parentId: string, pieceIds: string[]): StrataDocument {
  const spans = doc.layers.flatMap((l) => formSpans(l))
  const pieces = pieceIds.map((id) => spans.find((s) => s.id === id)).filter((s): s is Span => !!s)
  const overlap = (a: Span, b: Span) => Math.max(0, Math.min(a.endTime, b.endTime) - Math.max(a.startTime, b.startTime))
  const choose = (child: Span): string | null => {
    let best: Span | null = null
    for (const p of pieces) if (overlap(child, p) > EPS && (!best || overlap(child, p) > overlap(child, best) + EPS)) best = p
    return best?.id ?? null
  }
  let changed = false
  const layers = doc.layers.map((l) => {
    if (l.type !== 'form-diagram' || !l.data.spans.some((s) => s.parentId === parentId)) return l
    const next = l.data.spans.map((s) => {
      if (s.parentId !== parentId) return s
      const to = choose(s)
      if (to === parentId) return s
      changed = true
      return { ...s, parentId: to }
    })
    return { ...l, data: { ...l.data, spans: next } }
  })
  return changed ? { ...doc, layers } : doc
}
