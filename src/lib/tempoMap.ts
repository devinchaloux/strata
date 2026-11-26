/**
 * The tempo map of a run of marked bars: where the tempo is steady, and where
 * it ramps and how, the way a DAW's tempo track is built (docs/decisions.md,
 * "The Tempo Map"). The tempo widget draws it (its Tempo map view), and
 * Normalize's Steady between ramps fits the bars to it.
 *
 * A map is a list of pieces covering the run, each a stretch of bars:
 * - steady: one tempo, the straight line that best fits all the stretch's marks
 *   (findFlats in lib/normalize.ts finds them);
 * - ramp: the tempo changing evenly from one end to the other, in one of two
 *   shapes, whichever fits the marks better: by the same percentage each bar
 *   (`percent`; tempo × r each bar), or by the same number of BPM each bar
 *   (`bpm`). A stretch between steady ones that one ramp can't fit is split
 *   where its rate changes, into ramps that each fit;
 * - as marked: an odd bar (oddBars: a held fade, a pickup), kept as it is.
 *
 * Pieces meet at corners, boundary indices into the run's times. A corner next
 * to a steady piece sits on that piece's line; a corner between two ramps, and
 * the run's two ends, stay where they were marked. Nothing here is stored.
 */
import { findFlats, lineFit, oddBars, planFrom, tappingScatter, type NormalizePlan } from '@/lib/normalize'

export type RampShape = 'percent' | 'bpm'

export interface MapPiece {
  /** Boundary indices into the run's times: the piece is bars from+1 … to, counting from 1. */
  from: number
  to: number
  kind: 'steady' | 'ramp' | 'asMarked'
  /** A ramp's shape; absent = whichever fits better. */
  shape?: RampShape
}

export interface MapSegment extends MapPiece {
  /** The tempo of the piece's first and last bar, as fitted, in BPM. */
  startBpm: number
  endBpm: number
  /** A ramp's rate: percent a bar (`percent`) or BPM a bar (`bpm`); 0 for the others. */
  rate: number
}

/** A ramp is at least this many bars; a stretch is split no finer. */
export const RAMP_MIN_BARS = 3
/**
 * What a corner between two ramps must save, in squared tapping scatters, to
 * stay: without it, the map would miss the marks by more than that much more.
 * Hand-marked drift runs over several bars, so this is well above the 2 to 6 a
 * model-selection rule for independent scatter would ask.
 */
export const CORNER_COST = 40

const square = (xs: number[]) => xs.reduce((s, v) => s + v * v, 0)

// ---------------------------------------------------------------------------
// The continuous fit
// ---------------------------------------------------------------------------
//
// A map is fitted as one tempo line: each corner has a tempo, a steady piece
// keeps one tempo from corner to corner, and a ramp runs from its first
// corner's tempo to its last in its shape, each bar at the tempo at its middle.
// The line can't jump at a corner, as a DAW's tempo track doesn't. The bars'
// times follow from the tempos and a start time; both are found by least
// squares (Levenberg–Marquardt) on all the marks, each miss in plain seconds:
// a downbeat is tapped about as tightly in a slow bar as in a fast one. The run's two ends are single taps like any other, so they don't pin
// the line: holding them would push their error into every tempo. Where the
// ends must stay (Normalize), only the first and last bar take up the
// difference.

/** Bar lengths (seconds) for knot tempos `T` (bars per second) on `pieces` (one clean run, from 0). */
function barLengths(pieces: MapPiece[], shapes: RampShape[], T: number[]): number[] {
  const lens: number[] = []
  pieces.forEach((p, i) => {
    const a = T[i]
    const b = p.kind === 'steady' ? a : T[i + 1]
    const m = p.to - p.from
    for (let j = 0; j < m; j++) {
      const f = (j + 0.5) / m
      const t = p.kind === 'steady' ? a : shapes[i] === 'percent' ? a * (b / a) ** f : a + (b - a) * f
      lens.push(1 / Math.max(t, 1e-6))
    }
  })
  return lens
}

interface ContinuousFit {
  times: number[]
  /** Each inner boundary's miss (index k − 1 for boundary k), in seconds. */
  misses: number[]
  /** Root mean square of the misses, in seconds, comparable to the tapping scatter. */
  spread: number
  shapes: RampShape[]
}

/**
 * Fit one clean run (no odd bars) to `pieces` (from 0 to n, covering it) as a
 * continuous tempo line, with `shapes` for the ramps (absent = try both,
 * keep the better, ramp by ramp).
 */
function fitContinuous(times: number[], pieces: MapPiece[], shapes?: Array<RampShape | undefined>): ContinuousFit {
  const n = times.length - 1
  const marked = times.slice(1).map((t, k) => t - times[k])
  // Knot tempos: one per corner, a steady piece's two corners shared.
  const knotOf: number[] = []
  let params = 0
  pieces.forEach((p, i) => {
    if (i === 0) knotOf.push(params++)
    knotOf.push(p.kind === 'steady' ? knotOf[i] : params++)
  })
  const localTempo = (k: number) => {
    const near = marked.slice(Math.max(0, k - 2), Math.min(n, k + 2)).sort((a, b) => a - b)
    return 1 / near[near.length >> 1]
  }
  // A steady piece keeps the tempo of the line through its own marks: they are
  // the best evidence for it, and the ramps, which can't follow the marks
  // exactly, would otherwise pull it a little their way.
  const held = new Map<number, number>()
  pieces.forEach((p, i) => {
    if (p.kind !== 'steady' || p.to - p.from < 2) return
    const [, perBar] = lineFit(times, p.from, p.to)
    if (perBar > 0) held.set(knotOf[i], Math.log(1 / perBar))
  })
  // The last parameter is the line's start time, as an offset from the first mark.
  const x0 = new Array<number>(params + 1).fill(0)
  pieces.forEach((p, i) => {
    x0[knotOf[i]] = Math.log(localTempo(p.from))
    x0[knotOf[i + 1]] = Math.log(localTempo(p.to))
  })
  held.forEach((v, q) => (x0[q] = v))
  const residuals = (x: number[], sh: RampShape[]) => {
    const T = knotOf.map((q) => Math.exp(x[q]))
    const lens = barLengths(pieces, sh, T)
    let t = times[0] + x[params]
    const r: number[] = [t - times[0]]
    held.forEach((v, q) => r.push((x[q] - v) * 1e4))
    for (let k = 1; k <= n; k++) {
      t += lens[k - 1]
      r.push(t - times[k])
    }
    return r
  }
  const solve = (sh: RampShape[]) => {
    let x = [...x0]
    let r = residuals(x, sh)
    let cost = square(r)
    let mu = 1e-3
    for (let it = 0; it < 60; it++) {
      // Jacobian by finite differences.
      const J = x.map((_, q) => {
        const y = [...x]
        y[q] += 1e-6
        return residuals(y, sh).map((v, i) => (v - r[i]) / 1e-6)
      })
      const P = x.length
      const A = Array.from({ length: P }, (_, i) => Array.from({ length: P }, (_, j) => J[i].reduce((s, v, k) => s + v * J[j][k], 0)))
      const g = Array.from({ length: P }, (_, i) => J[i].reduce((s, v, k) => s + v * r[k], 0))
      let improved = false
      for (let tries = 0; tries < 8 && !improved; tries++) {
        const M = A.map((row, i) => row.map((v, j) => (i === j ? v * (1 + mu) + 1e-12 : v)))
        const step = solveDense(M, g.map((v) => -v))
        if (!step) break
        const y = x.map((v, i) => v + step[i])
        const ry = residuals(y, sh)
        const cy = square(ry)
        if (cy < cost) {
          ;[x, r, cost] = [y, ry, cy]
          mu = Math.max(1e-9, mu / 3)
          improved = true
        } else mu *= 4
      }
      if (!improved) break
    }
    const T = knotOf.map((q) => Math.exp(x[q]))
    const lens = barLengths(pieces, sh, T)
    const out = [times[0] + x[params]]
    for (const len of lens) out.push(out[out.length - 1] + len)
    // misses[k − 1] is inner boundary k's (after the held tempos' terms).
    const inner = r.slice(1 + held.size, -1)
    return { times: out, misses: inner, spread: inner.length ? Math.sqrt(square(inner) / inner.length) : 0, cost }
  }
  let sh: RampShape[] = pieces.map((_, i) => shapes?.[i] ?? 'percent')
  let best = solve(sh)
  // A ramp with no shape given takes whichever fits better, one at a time.
  pieces.forEach((p, i) => {
    if (p.kind !== 'ramp' || shapes?.[i]) return
    const other = sh.map((v, j) => (j === i ? (v === 'percent' ? 'bpm' : 'percent') : v))
    const fit = solve(other)
    if (fit.cost < best.cost) [sh, best] = [other, fit]
  })
  return { times: best.times, misses: best.misses, spread: best.spread, shapes: sh }
}

function solveDense(M: number[][], v: number[]): number[] | null {
  const n = v.length
  const A = M.map((row, i) => [...row, v[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-15) return null
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]
    }
  }
  return A.map((row, i) => row[n] / row[i])
}

/** The clean runs of a map: stretches between its as-marked pieces, with their pieces shifted to start at 0. */
function cleanParts(pieces: MapPiece[]): Array<{ from: number; to: number; pieces: MapPiece[] }> {
  const parts: Array<{ from: number; to: number; pieces: MapPiece[] }> = []
  for (const p of pieces) {
    if (p.kind === 'asMarked') continue
    const last = parts[parts.length - 1]
    if (last && last.to === p.from) {
      last.pieces.push(p)
      last.to = p.to
    } else parts.push({ from: p.from, to: p.to, pieces: [p] })
  }
  return parts.map((part) => ({ ...part, pieces: part.pieces.map((p) => ({ ...p, from: p.from - part.from, to: p.to - part.from })) }))
}

export interface FittedMap {
  /** The run's boundary times on the map; its two ends, and odd bars, as marked. */
  times: number[]
  /** The same, the ends where the line puts them: what the map's tempos are read from. */
  line: number[]
  segments: MapSegment[]
}

/**
 * Fit a run's marks to a map: one continuous tempo line through each stretch
 * between odd bars, which stay as marked. Each piece comes back with its
 * tempos and, for a ramp, its shape (as given, else whichever fits better) and
 * rate, at `beatsPerBar`.
 */
export function fitTempoMap(times: number[], pieces: MapPiece[], beatsPerBar = 4): FittedMap {
  const line = [...times]
  const shapes = new Map<number, RampShape>()
  for (const part of cleanParts(pieces)) {
    const fit = fitContinuous(times.slice(part.from, part.to + 1), part.pieces, part.pieces.map((p) => p.shape))
    for (let k = part.from; k <= part.to; k++) line[k] = fit.times[k - part.from]
    part.pieces.forEach((p, i) => shapes.set(p.from + part.from, fit.shapes[i]))
  }
  // Held: the run's ends and the edges of odd bars, as marked.
  const out = [...line]
  out[0] = times[0]
  out[out.length - 1] = times[times.length - 1]
  for (const p of pieces) if (p.kind === 'asMarked') [out[p.from], out[p.to]] = [times[p.from], times[p.to]]
  const segments = pieces.map((p): MapSegment => {
    const bpm = (k: number) => (60 * beatsPerBar) / (line[k + 1] - line[k])
    const startBpm = bpm(p.from)
    const endBpm = bpm(p.to - 1)
    if (p.kind !== 'ramp') return { ...p, startBpm, endBpm, rate: 0 }
    const shape = p.shape ?? shapes.get(p.from) ?? 'percent'
    const steps = Math.max(1, p.to - p.from - 1)
    const rate = shape === 'percent' ? ((endBpm / startBpm) ** (1 / steps) - 1) * 100 : (endBpm - startBpm) / steps
    return { ...p, shape, startBpm, endBpm, rate }
  })
  return { times: out, line, segments }
}

/**
 * Whether a ramp's fit moves its marks further than tapping explains: one
 * boundary more than 3 times the tapping scatter, or three in a row more than
 * twice it on the same side (a shape that doesn't match, rather than a bad tap).
 * `misses` are the fitted times minus the marks, for the ramp's boundaries.
 */
function rampMisfits(misses: number[], sigma: number): boolean {
  let run = 0
  for (let k = 0; k < misses.length; k++) {
    if (Math.abs(misses[k]) > 3 * sigma) return true
    const far = Math.abs(misses[k]) > 2 * sigma
    run = far && k > 0 && Math.sign(misses[k]) === Math.sign(misses[k - 1]) && Math.abs(misses[k - 1]) > 2 * sigma ? run + 1 : far ? 1 : 0
    if (run >= 3) return true
  }
  return false
}

/** Where to split ramp [a, b]: the boundary at which two ramps fit its marks best, fitted on their own. */
function bestSplit(times: number[], a: number, b: number): number {
  const seg = times.slice(a, b + 1)
  let best = -1
  let bestSpread = Infinity
  for (let c = RAMP_MIN_BARS; c <= b - a - RAMP_MIN_BARS; c++) {
    const fit = fitContinuous(seg, [
      { from: 0, to: c, kind: 'ramp' },
      { from: c, to: b - a, kind: 'ramp' },
    ])
    if (fit.spread < bestSpread) [bestSpread, best] = [fit.spread, c]
  }
  return best < 0 ? -1 : a + best
}

/**
 * The tempo map of a run of marked bars, as proposed pieces.
 *
 * 1. Steady stretches come from findFlats and odd bars from oddBars; the
 *    stretch between each pair is one ramp to begin with.
 * 2. The whole map is fitted (fitTempoMap). Any ramp whose fit moves the marks
 *    further than tapping explains (rampMisfits) is split where two ramps fit
 *    it best, the worst first, and the map fitted again, until every ramp
 *    fits or is too short to split (RAMP_MIN_BARS on each side).
 * 3. Two ramps in a row are merged where the map still fits as well as
 *    tapping allows (the merged ramp doesn't misfit, and no more ramps misfit
 *    than before) and the corner between them saves no more than CORNER_COST
 *    squared tapping scatters of miss.
 */
export function detectTempoMap(times: number[]): MapPiece[] {
  const n = times.length - 1
  if (n < 1) return []
  const odd = oddBars(times)
  const sigma = tappingScatter(times)
  const fixed: MapPiece[] = [
    ...findFlats(times).map((f) => ({ from: f.from, to: f.to, kind: 'steady' as const })),
    ...odd.flatMap((o, k) => (o ? [{ from: k, to: k + 1, kind: 'asMarked' as const }] : [])),
  ].sort((x, y) => x.from - y.from)
  let pieces: MapPiece[] = []
  let k = 0
  for (const p of fixed) {
    if (p.from > k) pieces.push({ from: k, to: p.from, kind: 'ramp' })
    pieces.push(p)
    k = p.to
  }
  if (k < n) pieces.push({ from: k, to: n, kind: 'ramp' })

  /** Each ramp's misses on the whole map's fit (the line's times, not the held ends). */
  const rampMisses = (ps: MapPiece[]) => {
    const { line } = fitTempoMap(times, ps)
    return ps.map((p) => (p.kind === 'ramp' ? line.slice(p.from, p.to + 1).map((t, j) => t - times[p.from + j]) : []))
  }

  for (let round = 0; round < 24; round++) {
    const misses = rampMisses(pieces)
    // The worst misfitting ramp that can still be split.
    let worst = -1
    let worstMiss = 0
    pieces.forEach((p, i) => {
      if (p.kind !== 'ramp' || p.to - p.from < 2 * RAMP_MIN_BARS || !rampMisfits(misses[i], sigma)) return
      const m = Math.max(...misses[i].map(Math.abs))
      if (m > worstMiss) [worstMiss, worst] = [m, i]
    })
    if (worst < 0) break
    const p = pieces[worst]
    const c = bestSplit(times, p.from, p.to)
    if (c < 0) break
    pieces = [...pieces.slice(0, worst), { from: p.from, to: c, kind: 'ramp' }, { from: c, to: p.to, kind: 'ramp' }, ...pieces.slice(worst + 1)]
  }

  // Merge two ramps in a row wherever the map still fits as well as tapping
  // allows (the line is continuous, so a merge can make a neighbouring ramp
  // misfit: no more ramps may misfit than before) and the corner between them
  // doesn't save more than CORNER_COST scatters².
  const misfitCount = (ps: MapPiece[]) => rampMisses(ps).filter((m, i) => ps[i].kind === 'ramp' && rampMisfits(m, sigma)).length
  const missIn = (ps: MapPiece[], from: number, to: number) => {
    const { line } = fitTempoMap(times, ps)
    return square(line.slice(from + 1, to).map((t, j) => t - times[from + 1 + j]))
  }
  for (let i = 0; i + 1 < pieces.length; ) {
    if (pieces[i].kind === 'ramp' && pieces[i + 1].kind === 'ramp') {
      const [from, to] = [pieces[i].from, pieces[i + 1].to]
      const merged = [...pieces.slice(0, i), { from, to, kind: 'ramp' as const }, ...pieces.slice(i + 2)]
      const fits = !rampMisfits(rampMisses(merged)[i], sigma) && misfitCount(merged) <= misfitCount(pieces)
      if (fits && missIn(merged, from, to) - missIn(pieces, from, to) <= CORNER_COST * sigma * sigma) {
        pieces = merged
        continue
      }
    }
    i++
  }
  return pieces
}

/** Normalize's Steady between ramps: what fitting a run's bars to the map `pieces` would do. */
export function rampsPlan(times: number[], pieces: MapPiece[]): NormalizePlan {
  return planFrom(times, fitTempoMap(times, pieces).times)
}

/** A ramp's rate as the strip and the tempo widget write it: "+3.9%/bar", "−2.9 BPM/bar". */
export function rateText(s: MapSegment): string {
  const sign = s.rate < 0 ? '−' : '+'
  const v = Math.abs(s.rate)
  return s.shape === 'percent' ? `${sign}${v.toFixed(1)}%/bar` : `${sign}${v.toFixed(1)} BPM/bar`
}
