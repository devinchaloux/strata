/**
 * Near misses: a boundary close to another layer's line but not on it, so it
 * won't move with it (docs/decisions.md, "Shared Moments Move Together"). Two
 * layers' boundaries move together only at exactly the same moment
 * (followLinks), so one marked a little apart, or left behind when the other
 * was re-tapped or normalized, is easy to miss. The diagram marks each one,
 * and the mark offers to move it onto the line.
 *
 * A near miss is reported on the coarser layer (fewer spans), as moving onto
 * the finer one's line: bars are usually marked more carefully than the
 * phrases over them, and a finer layer's lines are the ones a coarser layer is
 * built on. Hidden layers count; a locked layer's boundaries aren't offered
 * for moving.
 */
import type { Layer, StrataDocument } from '@/types/strata'
import { segmentSpans } from '@/lib/layers'

/** How far apart counts as a near miss: half a second, the slack in pressing a key by ear (as SPLIT_SNAP_SEC). */
export const NEAR_MISS_SEC = 0.5
const EPS = 1e-6

export interface NearMiss {
  /** The layer whose boundary is off, and where it is. */
  layerId: string
  time: number
  /** The finer layer's line it is near, and where that is. */
  ontoLayerId: string
  ontoTime: number
}

/** A layer's boundaries: every span edge, once each, in order. */
function edges(layer: Layer): number[] {
  const out: number[] = []
  for (const s of segmentSpans(layer)) out.push(s.startTime, s.endTime)
  out.sort((a, b) => a - b)
  return out.filter((t, i) => i === 0 || t - out[i - 1] > EPS)
}

/** The edge in a sorted list nearest to t. */
function nearest(sorted: number[], t: number): number | null {
  let lo = 0
  let hi = sorted.length - 1
  if (hi < 0) return null
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < t) lo = mid + 1
    else hi = mid
  }
  const a = sorted[lo]
  const b = lo > 0 ? sorted[lo - 1] : a
  return Math.abs(a - t) < Math.abs(b - t) ? a : b
}

/**
 * Every near miss in the document: for each pair of form layers, each
 * boundary of the coarser one within NEAR_MISS_SEC of the finer one's nearest
 * line, but not on it (and on no other layer's line at its moment, since it
 * is then shared already, just not with this layer). A boundary near several
 * finer layers is reported once, for the nearest.
 */
export function nearMisses(doc: StrataDocument): NearMiss[] {
  const layers = doc.layers.filter((l) => l.type === 'segmentation' && segmentSpans(l).length > 0)
  const lines = new Map(layers.map((l) => [l.id, edges(l)]))
  const count = (l: Layer) => segmentSpans(l).length
  const out: NearMiss[] = []
  for (const layer of layers) {
    if (layer.locked) continue
    for (const t of lines.get(layer.id)!) {
      let best: NearMiss | null = null
      for (const other of layers) {
        if (other.id === layer.id || count(other) <= count(layer)) continue
        const f = nearest(lines.get(other.id)!, t)
        if (f == null) continue
        const gap = Math.abs(f - t)
        if (gap <= EPS) {
          best = null
          break
        }
        if (gap <= NEAR_MISS_SEC && (!best || gap < Math.abs(best.ontoTime - t))) best = { layerId: layer.id, time: t, ontoLayerId: other.id, ontoTime: f }
      }
      if (best) out.push(best)
    }
  }
  return out
}

/** The near misses of one layer onto another: what Line up with would move. */
export function nearMissesBetween(doc: StrataDocument, layerId: string, ontoLayerId: string): NearMiss[] {
  return nearMisses(doc).filter((m) => m.layerId === layerId && m.ontoLayerId === ontoLayerId)
}
