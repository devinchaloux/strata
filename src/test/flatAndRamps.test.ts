/**
 * Steady between ramps (lib/normalize.ts; docs/decisions.md, "Steady Between
 * Ramps"): finding steady stretches in hand-marked bars, offering the fit only
 * when there is both a stretch and a ramp, and fitting it.
 */
import { describe, it, expect } from 'vitest'
import { findFlats, flatBpmOf, rampsOffered, settleFlats } from '@/lib/normalize'

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

describe('settleFlats', () => {
  it('orders, clamps, and splits an overlap down the middle', () => {
    expect(settleFlats([{ from: 30, to: 50 }, { from: -2, to: 34 }], 40)).toEqual([
      { from: 0, to: 32 },
      { from: 32, to: 40 },
    ])
  })
})
