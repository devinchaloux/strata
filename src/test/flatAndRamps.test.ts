/**
 * Steady between ramps (lib/normalize.ts; docs/decisions.md, "Steady Between
 * Ramps"): finding steady stretches in hand-marked bars, offering the fit only
 * when there is both a stretch and a ramp, and fitting it.
 */
import { describe, it, expect } from 'vitest'
import { autoLogLambda, findFlats, flatAndRampsTimes, flatBpmOf, normalizePlan, rampsOffered, settleFlats, smoothFixed, smoothTimes } from '@/lib/normalize'

/** A seeded normal generator, so the tests don't flake. */
function rng(seed: number) {
  let s = seed >>> 0
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 2 ** 32
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
}

/** Boundary times for bars at these tempos (4/4), with tapping scatter of `noise` seconds; the ends exact. */
function marked(bpms: number[], noise: number, seed = 1): number[] {
  const g = rng(seed)
  const times = [0]
  bpms.forEach((b) => times.push(times[times.length - 1] + 240 / b))
  return times.map((t, k) => (k === 0 || k === times.length - 1 ? t : t + noise * g()))
}

const lin = (a: number, b: number, n: number) => Array.from({ length: n }, (_, k) => a + ((b - a) * (k + 1)) / (n + 1))
const geom = (a: number, b: number, n: number) => Array.from({ length: n }, (_, k) => a * (b / a) ** (k / (n - 1)))

describe('findFlats', () => {
  it('finds two steady stretches either side of a ramp, corners within a bar', () => {
    const bpms = [...Array(40).fill(120), ...lin(120, 140, 15), ...Array(40).fill(140)]
    for (const seed of [1, 2, 3]) {
      const times = marked(bpms, 0.015, seed)
      const flats = findFlats(times)
      expect(flats).toHaveLength(2)
      expect(Math.abs(flats[0].to - 40)).toBeLessThanOrEqual(1)
      expect(Math.abs(flats[1].from - 55)).toBeLessThanOrEqual(1)
      expect(flatBpmOf(times, flats[0], 4)).toBeCloseTo(120, 0)
      expect(flatBpmOf(times, flats[1], 4)).toBeCloseTo(140, 0)
      expect(rampsOffered(times, flats, 4, 4)).toBe(true)
    }
  })

  it('finds the steady middle between an accelerando and a ritardando', () => {
    const bpms = [...geom(40, 126, 40), ...Array(100).fill(126), ...geom(126, 40, 40)]
    const times = marked(bpms, 0.02)
    const flats = findFlats(times)
    expect(flats).toHaveLength(1)
    expect(flatBpmOf(times, flats[0], 4)).toBeCloseTo(126, 0)
    expect(rampsOffered(times, flats, 4, 4)).toBe(true)
  })

  it('is not offered for a steady tempo throughout: Steady does that', () => {
    const times = marked(Array(80).fill(124), 0.02)
    const flats = findFlats(times)
    expect(rampsOffered(times, flats, 4, 4)).toBe(false)
  })

  it('is not offered for an accelerando with no steady stretch: Smooth does that', () => {
    for (const noise of [0.01, 0.025]) {
      const times = marked(lin(90, 130, 80), noise)
      expect(rampsOffered(times, findFlats(times), 4, 4)).toBe(false)
    }
  })

  it('is not offered for a slow drift of a couple of BPM, or for rubato', () => {
    const drift = marked(lin(120, 122, 80), 0.025)
    expect(rampsOffered(drift, findFlats(drift), 4, 4)).toBe(false)
    const rubato = marked(Array.from({ length: 80 }, (_, k) => 120 + 3 * Math.sin(k / 4)), 0.015)
    expect(rampsOffered(rubato, findFlats(rubato), 4, 4)).toBe(false)
  })

  it('isn’t ended by a mistimed tap or two that comes back to the line', () => {
    // Steady 126 for 110 bars, then a slowdown; two taps late by 100 and 170 ms at bars 96–97.
    const bpms = [...Array(110).fill(126), ...geom(126, 60, 30)]
    const times = marked(bpms, 0.018)
    times[96] += 0.1
    times[97] += 0.17
    const flats = findFlats(times)
    expect(flats).toHaveLength(1)
    expect(Math.abs(flats[0].to - 110)).toBeLessThanOrEqual(2)
  })

  it('needs sixteen bars or more', () => {
    const times = marked([...Array(10).fill(120), ...lin(120, 140, 10)], 0.01)
    expect(findFlats(times)).toEqual([])
  })
})

describe('flatAndRampsTimes', () => {
  it('puts each stretch at one tempo and keeps the run’s ends', () => {
    const bpms = [...Array(40).fill(120), ...lin(120, 140, 15), ...Array(40).fill(140)]
    const times = marked(bpms, 0.015)
    const flats = findFlats(times)
    const out = flatAndRampsTimes(times, flats, 10 ** autoLogLambda(times))
    expect(out[0]).toBe(times[0])
    expect(out[out.length - 1]).toBe(times[times.length - 1])
    const len = (k: number) => out[k + 1] - out[k]
    for (const f of flats) for (let k = f.from + 1; k < f.to - 1; k++) expect(len(k)).toBeCloseTo(len(f.from + 1), 9)
  })

  it('leaves an odd bar (a long last bar) as marked, and doesn’t smooth it into the ramp', () => {
    const bpms = [...Array(30).fill(126), ...geom(126, 60, 20)]
    const times = marked(bpms, 0.015)
    times.push(times[times.length - 1] + 25) // a fade held in a 25-second last bar
    const flats = findFlats(times)
    const out = flatAndRampsTimes(times, flats, 10 ** autoLogLambda(times))
    expect(out[out.length - 2]).toBe(times[times.length - 2])
    const moves = out.map((t, k) => Math.abs(t - times[k]))
    expect(Math.max(...moves)).toBeLessThan(0.15)
  })

  it('takes moved corners', () => {
    const bpms = [...Array(40).fill(120), ...lin(120, 140, 15), ...Array(40).fill(140)]
    const times = marked(bpms, 0.015)
    const plan = normalizePlan(times, 'ramps', 1, [{ from: 0, to: 30 }, { from: 60, to: 95 }])
    const len = (k: number) => plan.times[k + 1] - plan.times[k]
    expect(len(5)).toBeCloseTo(len(25), 9)
    expect(len(70)).toBeCloseTo(len(90), 9)
  })
})

describe('settleFlats', () => {
  it('orders, clamps, and splits an overlap down the middle', () => {
    expect(settleFlats([{ from: 30, to: 50 }, { from: -2, to: 34 }], 40)).toEqual([
      { from: 0, to: 32 },
      { from: 32, to: 40 },
    ])
  })
})

describe('smoothFixed', () => {
  it('is smoothTimes when only the ends are held', () => {
    const t = Array.from({ length: 30 }, (_, k) => k * 2 + 0.05 * k * k + (k % 3) * 0.02)
    const held = t.map((_, k) => k === 0 || k === 29)
    expect(smoothFixed(t, 50, held)).toEqual(smoothTimes(t, 50))
  })
})
