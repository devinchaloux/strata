/**
 * Normalize: even out the boundaries of a run of bars marked by hand, keeping
 * its two ends where they are. docs/decisions.md, "Normalize".
 *
 * Steady puts every bar at the same length: one tempo across the run.
 * Steady between ramps (findFlats, flatAndRampsTimes) is for a tempo made in
 * a DAW: steady stretches joined by ramps. Each steady stretch is a straight
 * line fitted to all its marks; the ramps are smoothed between them, held at
 * the corners. It is offered only when the bars have such a shape
 * (rampsOffered), and its corners are proposals the analyst can move.
 *
 * Smooth (on the runs between odd bars, which it keeps; oddBars) fits a curve
 * that follows a tempo that moves (an accelerando, a
 * ritardando) and leaves out the scatter of tapping. It is a penalized least
 * squares fit of the boundary times (a Whittaker smoother on third
 * differences, so bar lengths change smoothly): `lambda` sets how smooth. The
 * automatic setting is the smoothest at which what is left over still looks
 * like tapping scatter, boundary by boundary unrelated to its neighbours (the
 * leftovers' lag-1 correlation reaches 0); smoother than that, the fit starts
 * to cut corners off the music.
 *
 * Pure functions; the store's normalizeBars applies a result.
 */

/** Boundary times of `n` equal bars from the first time to the last. */
export function steadyTimes(times: number[]): number[] {
  const n = times.length - 1
  if (n < 1) return [...times]
  const a = times[0]
  const b = times[n]
  return times.map((_, k) => (k === n ? b : a + ((b - a) * k) / n))
}

/** Third-difference penalty matrix DᵀD for m points, as a function of (i, j). */
function penalty(m: number): (i: number, j: number) => number {
  const d = [-1, 3, -3, 1]
  return (i, j) => {
    if (Math.abs(i - j) > 3) return 0
    let sum = 0
    // Rows k of D touching both i and j: k ≤ min(i, j) and k + 3 ≥ max(i, j).
    for (let k = Math.max(0, Math.max(i, j) - 3); k <= Math.min(i, j) && k <= m - 4; k++) sum += d[i - k] * d[j - k]
    return sum
  }
}

/**
 * Solve A x = b for a symmetric positive definite band matrix of half
 * bandwidth p, given A as a function of (i, j), by band Cholesky.
 */
function solveBand(n: number, p: number, A: (i: number, j: number) => number, b: number[]): number[] {
  const w = p + 1
  const L = new Float64Array(n * w) // L[i][j] at i*w + (i - j)
  const get = (i: number, j: number) => (i - j > p || j > i ? 0 : L[i * w + (i - j)])
  for (let i = 0; i < n; i++) {
    for (let j = Math.max(0, i - p); j <= i; j++) {
      let sum = A(i, j)
      for (let k = Math.max(0, i - p); k < j; k++) sum -= get(i, k) * get(j, k)
      L[i * w + (i - j)] = i === j ? Math.sqrt(Math.max(sum, 1e-300)) : sum / get(j, j)
    }
  }
  const y = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    let sum = b[i]
    for (let k = Math.max(0, i - p); k < i; k++) sum -= get(i, k) * y[k]
    y[i] = sum / get(i, i)
  }
  const x = new Array<number>(n)
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i]
    for (let k = i + 1; k <= Math.min(n - 1, i + p); k++) sum -= get(k, i) * x[k]
    x[i] = sum / get(i, i)
  }
  return x
}

/**
 * The boundary times smoothed with `lambda`, the first and last kept exactly.
 * Fewer than four times (three bars) can't be smoothed and come back as they are.
 */
export function smoothTimes(times: number[], lambda: number): number[] {
  const m = times.length
  if (m < 4 || !(lambda > 0)) return [...times]
  const P = penalty(m)
  const last = m - 1
  // Unknowns are the inner times 1..m-2; the ends move to the right-hand side.
  const n = m - 2
  const A = (i: number, j: number) => (i === j ? 1 : 0) + lambda * P(i + 1, j + 1)
  const b = Array.from({ length: n }, (_, i) => times[i + 1] - lambda * (P(i + 1, 0) * times[0] + P(i + 1, last) * times[last]))
  const inner = solveBand(n, 3, A, b)
  return [times[0], ...inner, times[last]]
}

/**
 * smoothTimes with any boundaries held: `fixed[i]` keeps times[i] as it is, and
 * the rest are fitted around them. Holding a few boundaries on either side of a
 * free stretch carries their tempo into it, so a ramp leaves a steady stretch
 * at that stretch's tempo.
 */
export function smoothFixed(times: number[], lambda: number, fixed: boolean[]): number[] {
  const m = times.length
  const free = times.map((_, i) => i).filter((i) => !fixed[i])
  if (m < 4 || !free.length || !(lambda > 0)) return [...times]
  const P = penalty(m)
  // Dropping the held rows and columns keeps the matrix banded: two free
  // boundaries within 3 of each other are within 3 of each other in `free`.
  const A = (i: number, j: number) => (i === j ? 1 : 0) + lambda * P(free[i], free[j])
  const b = free.map((i) => {
    let sum = times[i]
    for (let j = Math.max(0, i - 3); j <= Math.min(m - 1, i + 3); j++) if (fixed[j]) sum -= lambda * P(i, j) * times[j]
    return sum
  })
  const x = solveBand(free.length, 3, A, b)
  const out = [...times]
  free.forEach((i, k) => (out[i] = x[k]))
  return out
}

/** Lag-1 correlation of what smoothing left over at the inner boundaries. */
function leftoverCorrelation(times: number[], fitted: number[]): number {
  const r = times.slice(1, -1).map((t, k) => t - fitted[k + 1])
  let num = 0
  let den = 0
  r.forEach((v, k) => {
    den += v * v
    if (k > 0) num += v * r[k - 1]
  })
  return den > 0 ? num / den : 0
}

/**
 * Bars far off their neighbours: more than 25% longer or shorter than the
 * running median of the seven bars around them (a fade held in a long last
 * bar, a pickup, a fermata). Smooth keeps them as they are and works on the
 * runs between them, so one odd bar isn't smoothed into the bars beside it.
 * An accelerando changes by a few percent a bar, well inside that.
 */
export function oddBars(times: number[]): boolean[] {
  const lens = times.slice(1).map((t, k) => t - times[k])
  return lens.map((len, k) => {
    const near = lens.slice(Math.max(0, k - 3), k + 4).sort((a, b) => a - b)
    const median = near[near.length >> 1]
    return Math.abs(len / median - 1) > 0.25
  })
}

/** The runs of ordinary bars between odd ones, as [first, last] indices into the boundary times. */
function cleanRuns(times: number[]): Array<[number, number]> {
  const odd = oddBars(times)
  const runs: Array<[number, number]> = []
  let start = -1
  odd.forEach((o, k) => {
    if (!o && start < 0) start = k
    if (o && start >= 0) {
      runs.push([start, k])
      start = -1
    }
  })
  if (start >= 0) runs.push([start, odd.length])
  return runs
}

/** smoothTimes on each run of ordinary bars, odd bars kept as marked. */
export function smoothAnchored(times: number[], lambda: number): number[] {
  const out = [...times]
  for (const [a, b] of cleanRuns(times)) {
    const fit = smoothTimes(times.slice(a, b + 1), lambda)
    for (let k = a; k <= b; k++) out[k] = fit[k - a]
  }
  return out
}

/** The range the smoothing scale covers, as log10 of lambda. */
export const LOG_LAMBDA_MIN = -2
export const LOG_LAMBDA_MAX = 6

/**
 * The automatic smoothing: the largest lambda at which the leftovers are still
 * uncorrelated, found by bisection on log10(lambda). Tapping scatter leaves
 * leftovers that alternate (negative correlation); once the fit starts missing
 * the music they run together (positive).
 */
export function autoLogLambda(times: number[]): number {
  // Read from the longest run of ordinary bars, so an odd bar doesn't decide it.
  const runs = cleanRuns(times)
  if (runs.length) {
    const [a, b] = runs.reduce((best, r) => (r[1] - r[0] > best[1] - best[0] ? r : best))
    if (b - a < times.length - 1) times = times.slice(a, b + 1)
  }
  if (times.length < 6) return 0
  const corr = (g: number) => leftoverCorrelation(times, smoothTimes(times, 10 ** g))
  let lo = LOG_LAMBDA_MIN
  let hi = LOG_LAMBDA_MAX
  if (corr(lo) >= 0) return lo
  if (corr(hi) <= 0) return hi
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    if (corr(mid) <= 0) lo = mid
    else hi = mid
  }
  return lo
}

/** How far the hand-marked times sit from the fitted ones, as a standard deviation in seconds. */
export function scatter(times: number[], fitted: number[]): number {
  const inner = times.slice(1, -1).map((t, k) => t - fitted[k + 1])
  if (!inner.length) return 0
  return Math.sqrt(inner.reduce((s, v) => s + v * v, 0) / inner.length)
}

// ---------------------------------------------------------------------------
// Steady between ramps
// ---------------------------------------------------------------------------

/** A steady stretch: boundary indices `from` to `to` into the run's times (bars from+1 … to, counting from 1). */
export interface Flat {
  from: number
  to: number
}

/** A bar whose smoothed tempo changes less than this from bar to bar (0.5%) counts as steady. */
export const FLAT_RATE = 0.005
/** Steady between ramps is offered only for a steady stretch at least this long. */
export const FLAT_MIN_BARS = 16
const SEED_MIN = 8

/** The least-squares line through times[a..b] against the boundary index: [intercept, seconds per bar]. */
function lineFit(times: number[], a: number, b: number): [number, number] {
  const n = b - a + 1
  let sk = 0
  let st = 0
  for (let k = a; k <= b; k++) {
    sk += k
    st += times[k]
  }
  const mk = sk / n
  const mt = st / n
  let num = 0
  let den = 0
  for (let k = a; k <= b; k++) {
    num += (k - mk) * (times[k] - mt)
    den += (k - mk) ** 2
  }
  const slope = den > 0 ? num / den : 0
  return [mt - slope * mk, slope]
}

/** What's left over from the line through times[a..b]. */
function lineLeftovers(times: number[], a: number, b: number): number[] {
  const [c, s] = lineFit(times, a, b)
  return times.slice(a, b + 1).map((t, j) => t - (c + s * (a + j)))
}

/**
 * How well a hinge fits times[lo..hi]: steady on one side of boundary `c`, and
 * on the other a tempo changing at a steady rate (bar lengths changing by the
 * same amount each bar, so times bend as a square). The sum of squared
 * leftovers; the best corner is the one with the least.
 */
function hingeMiss(times: number[], c: number, lo: number, hi: number, rampAfter: boolean): number {
  // Least squares for t = x0 + x1·k + x2·h(k)², by the 3×3 normal equations.
  const rows: number[][] = []
  for (let k = lo; k <= hi; k++) {
    const h = Math.max(0, rampAfter ? k - c : c - k)
    rows.push([1, k, h * h, times[k]])
  }
  const M = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)))
  const v = [0, 1, 2].map((i) => rows.reduce((s, r) => s + r[i] * r[3], 0))
  const x = solve3(M, v)
  if (!x) return Infinity
  return rows.reduce((s, r) => s + (r[3] - (x[0] + x[1] * r[1] + x[2] * r[2])) ** 2, 0)
}

function solve3(M: number[][], v: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const d = det(M)
  if (Math.abs(d) < 1e-12) return null
  return [0, 1, 2].map((c) => det(M.map((row, i) => row.map((x, j) => (j === c ? v[i] : x)))) / d)
}

/**
 * The steady stretches in a run of hand-marked bars, as proposals.
 *
 * 1. Smooth the run (Auto) and read each bar's rate of change of tempo; bars
 *    changing less than FLAT_RATE a bar are steady, and runs of at least eight
 *    are seeds.
 * 2. Grow or shrink each seed while a straight line still fits its marks as
 *    well as tapping allows: the leftovers' spread within 1.5 times the
 *    tapping scatter, and none beyond 4 times it.
 * 3. Place each corner where a hinge (steady, then a steady change) fits the
 *    twelve bars either side best: the growing in step 2 runs a bar or two into
 *    a ramp, since a ramp's first bars are hard to tell from steady.
 *
 * Stretches shorter than FLAT_MIN_BARS are dropped. Odd bars (oddBars) are
 * never inside a stretch.
 */
export function findFlats(times: number[]): Flat[] {
  const n = times.length - 1
  if (n < FLAT_MIN_BARS) return []
  const odd = oddBars(times)
  const fitted = smoothAnchored(times, 10 ** autoLogLambda(times))
  const left = times.map((t, k) => t - fitted[k]).slice(1, -1)
  const med = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b)
    return o[o.length >> 1] ?? 0
  }
  const m0 = med(left)
  // At least 10 ms: bars already smoothed, or laid from a grid, have lost
  // their scatter, but a hand-marked drift of a few tens of ms is still there.
  const sigma = Math.max(0.01, 1.4826 * med(left.map((r) => Math.abs(r - m0))))

  const logLen = fitted.slice(1).map((t, k) => Math.log(t - fitted[k]))
  const rate = logLen.map((_, k) => {
    const a = Math.max(0, k - 1)
    const b = Math.min(n - 1, k + 1)
    return b > a ? Math.abs(logLen[b] - logLen[a]) / (b - a) : 0
  })
  const steady = rate.map((r, k) => r < FLAT_RATE && !odd[k])

  const fits = (a: number, b: number) => {
    if (b - a < 2) return true
    for (let k = a; k < b; k++) if (odd[k]) return false
    const r = lineLeftovers(times, a, b)
    const spread = Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length)
    return spread <= 1.5 * sigma && Math.max(...r.map(Math.abs)) <= 4 * sigma
  }

  const flats: Flat[] = []
  for (let k = 0; k < n; ) {
    if (!steady[k]) {
      k++
      continue
    }
    let j = k
    while (j + 1 < n && steady[j + 1]) j++
    if (j - k + 1 >= SEED_MIN) {
      let a = k
      let b = j + 1
      while (b - a > SEED_MIN && !fits(a, b)) {
        const r = lineLeftovers(times, a, b)
        if (Math.abs(r[0]) > Math.abs(r[r.length - 1])) a++
        else b--
      }
      if (fits(a, b)) {
        while (a > 0 && fits(a - 1, b)) a--
        while (b < n && fits(a, b + 1)) b++
        flats.push({ from: a, to: b })
      }
    }
    k = j + 1
  }

  // Corners: a hinge fitted over the 12 bars either side, within 8 of where growing stopped.
  const W = 12
  const S = 8
  const placed = flats.map(({ from, to }) => {
    let a = from
    let b = to
    if (a > 0) {
      let best = Infinity
      for (let c = Math.max(1, from - S); c <= Math.min(to - SEED_MIN, from + S); c++) {
        const miss = hingeMiss(times, c, Math.max(0, c - W), Math.min(n, c + W), false)
        if (miss < best) [best, a] = [miss, c]
      }
    }
    if (b < n) {
      let best = Infinity
      for (let c = Math.max(a + SEED_MIN, to - S); c <= Math.min(n - 1, to + S); c++) {
        const miss = hingeMiss(times, c, Math.max(0, c - W), Math.min(n, c + W), true)
        if (miss < best) [best, b] = [miss, c]
      }
    }
    return { from: a, to: b }
  })
  return settleFlats(placed, n).filter((f) => f.to - f.from >= FLAT_MIN_BARS)
}

/** Flats in order, inside the run, each at least a bar long, and not overlapping: an overlap is split down the middle. */
export function settleFlats(flats: Flat[], n: number): Flat[] {
  const out = flats
    .map((f) => ({ from: Math.max(0, Math.min(n, f.from)), to: Math.max(0, Math.min(n, f.to)) }))
    .filter((f) => f.to > f.from)
    .sort((x, y) => x.from - y.from)
  for (let k = 1; k < out.length; k++) {
    if (out[k].from < out[k - 1].to) {
      const mid = Math.round((out[k].from + out[k - 1].to) / 2)
      out[k - 1] = { ...out[k - 1], to: mid }
      out[k] = { ...out[k], from: mid }
    }
  }
  return out.filter((f) => f.to > f.from)
}

/**
 * Whether to offer Steady between ramps: there is a steady stretch, and
 * somewhere else the tempo (smoothed, Auto) moves more than `movesBpm` away
 * from the nearest stretch's tempo, so there is a ramp to keep. With no ramp,
 * Steady does the job; with no steady stretch, Smooth does.
 */
export function rampsOffered(times: number[], flats: Flat[], beatsPerBar: number, movesBpm: number): boolean {
  if (!flats.length) return false
  const odd = oddBars(times)
  const fitted = smoothAnchored(times, 10 ** autoLogLambda(times))
  const flatBpm = flats.map((f) => flatBpmOf(times, f, beatsPerBar))
  const n = times.length - 1
  for (let k = 0; k < n; k++) {
    if (odd[k] || flats.some((f) => k >= f.from && k < f.to)) continue
    const bpm = (60 * beatsPerBar) / (fitted[k + 1] - fitted[k])
    let near = 0
    flats.forEach((f, i) => {
      const d = (x: Flat) => Math.min(Math.abs(k - x.from), Math.abs(k - x.to))
      if (d(f) < d(flats[near])) near = i
    })
    if (Math.abs(bpm - flatBpm[near]) > movesBpm) return true
  }
  return false
}

/** A steady stretch's tempo: the line through its marks. */
export function flatBpmOf(times: number[], f: Flat, beatsPerBar: number): number {
  const [, perBar] = lineFit(times, f.from, f.to)
  return perBar > 0 ? (60 * beatsPerBar) / perBar : 0
}

/**
 * Steady between ramps: each stretch on the line through its marks, and the
 * rest smoothed with `lambda` around them, the run's two ends, odd bars, and
 * the stretches held. A stretch that touches the run's end keeps that end.
 * Odd bars stay as marked.
 */
export function flatAndRampsTimes(times: number[], flats: Flat[], lambda: number): number[] {
  const n = times.length - 1
  const out = [...times]
  const fixed = times.map(() => false)
  for (const f of settleFlats(flats, n)) {
    const [c, s] = lineFit(times, f.from, f.to)
    for (let k = f.from; k <= f.to; k++) {
      if (k === 0 || k === n) continue
      out[k] = c + s * k
      fixed[k] = true
    }
  }
  // As Smooth does, each run between odd bars on its own (its ends held), so
  // an odd bar's jump in length isn't smoothed into the bars beside it.
  const result = [...out]
  for (const [a, b] of cleanRuns(times)) {
    const held = fixed.slice(a, b + 1).map((h, j) => h || j === 0 || j === b - a)
    const fit = smoothFixed(out.slice(a, b + 1), lambda, held)
    for (let k = a; k <= b; k++) result[k] = fit[k - a]
  }
  return result
}

export interface NormalizePlan {
  /** The new boundary times, the first and last unchanged. */
  times: number[]
  /** How many inner boundaries move by more than a millisecond. */
  moved: number
  /** The largest move, in seconds. */
  maxMove: number
  /** How far the hand-marked boundaries sit from the result (scatter). */
  scatter: number
}

export type NormalizeMode = 'steady' | 'smooth' | 'ramps'

/**
 * What normalizing a run's boundary times would do. For 'ramps', `flats` are
 * the steady stretches (as proposed by findFlats, or moved by the analyst).
 */
export function normalizePlan(times: number[], mode: NormalizeMode, logLambda: number, flats?: Flat[]): NormalizePlan {
  const next =
    mode === 'steady'
      ? steadyTimes(times)
      : mode === 'ramps'
        ? flatAndRampsTimes(times, flats ?? findFlats(times), 10 ** logLambda)
        : smoothAnchored(times, 10 ** logLambda)
  const moves = next.map((t, k) => Math.abs(t - times[k]))
  return {
    times: next,
    moved: moves.filter((d) => d > 0.001).length,
    maxMove: Math.max(0, ...moves),
    scatter: scatter(times, next),
  }
}

/**
 * The boundary times of a run of spans that follow one another (each starting
 * where the one before ends), or null when they don't.
 */
export function runTimes(spans: Array<{ startTime: number; endTime: number }>): number[] | null {
  if (!spans.length) return null
  const sorted = [...spans].sort((a, b) => a.startTime - b.startTime)
  for (let k = 1; k < sorted.length; k++) if (Math.abs(sorted[k].startTime - sorted[k - 1].endTime) > 1e-6) return null
  return [sorted[0].startTime, ...sorted.map((s) => s.endTime)]
}
