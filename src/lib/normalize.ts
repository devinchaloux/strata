/**
 * Normalize: even out the boundaries of a run of bars marked by hand, keeping
 * its two ends where they are. docs/decisions.md, "Normalize".
 *
 * Steady puts every bar at the same length: one tempo across the run.
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

/** What normalizing a run's boundary times would do. */
export function normalizePlan(times: number[], mode: 'steady' | 'smooth', logLambda: number): NormalizePlan {
  const next = mode === 'steady' ? steadyTimes(times) : smoothAnchored(times, 10 ** logLambda)
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
