/**
 * The tempo map (lib/tempoMap.ts; docs/decisions.md, "The Tempo Map"):
 * steady stretches and ramps at an even rate, found in hand-marked bars and
 * fitted as one continuous tempo line.
 */
import { describe, it, expect } from 'vitest'
import { detectTempoMap, fitTempoMap, rampsPlan, rateText, type MapPiece } from '@/lib/tempoMap'

function rng(seed: number) {
  let s = seed >>> 0
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 2 ** 32
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
}

/** Boundary times for bars at these tempos (4/4), with tapping scatter of `noise` as a share of each bar's length (1% ≈ 19 ms at 126 BPM). */
function marked(bpms: number[], noise: number, seed = 1): number[] {
  const g = rng(seed)
  const times = [0]
  bpms.forEach((b) => times.push(times[times.length - 1] + 240 / b))
  return times.map((t, k) => (k === 0 || k === times.length - 1 ? t : t + noise * (240 / bpms[Math.min(k, bpms.length - 1)]) * g()))
}

/** Tempos of `n` bars ramping from a to b, each bar at the tempo at its middle: the same percent each bar, or the same BPM. */
const pct = (a: number, b: number, n: number) => Array.from({ length: n }, (_, j) => a * (b / a) ** ((j + 0.5) / n))
const bpm = (a: number, b: number, n: number) => Array.from({ length: n }, (_, j) => a + (b - a) * ((j + 0.5) / n))

describe('detectTempoMap', () => {
  it('finds a ramp up by a percentage, a steady stretch, and a ramp down by BPM, with their shapes', () => {
    const bpms = [...pct(40, 126, 40), ...Array(80).fill(126), ...bpm(126, 40, 30)]
    const times = marked(bpms, 0.008)
    const pieces = detectTempoMap(times)
    const { segments } = fitTempoMap(times, pieces)
    expect(segments.map((s) => s.kind)).toEqual(['ramp', 'steady', 'ramp'])
    expect(Math.abs(segments[1].from - 40)).toBeLessThanOrEqual(2)
    expect(Math.abs(segments[1].to - 120)).toBeLessThanOrEqual(2)
    expect(segments[0].shape).toBe('percent')
    expect(segments[2].shape).toBe('bpm')
    expect(segments[1].startBpm).toBeCloseTo(126, 0)
    expect(segments[2].rate).toBeLessThan(-2.5)
    expect(segments[2].rate).toBeGreaterThan(-3.3)
  })

  it('splits a ramp where its rate changes, and not where it doesn’t', () => {
    const knee = [...pct(40, 100, 30), ...bpm(100, 126, 20), ...Array(40).fill(126)]
    const kneeMap = detectTempoMap(marked(knee, 0.008))
    expect(kneeMap.filter((p) => p.kind === 'ramp')).toHaveLength(2)
    const even = [...pct(40, 126, 50), ...Array(40).fill(126)]
    expect(detectTempoMap(marked(even, 0.008)).filter((p) => p.kind === 'ramp')).toHaveLength(1)
  })

  it('keeps an odd bar as marked', () => {
    const bpms = [...Array(40).fill(126), ...bpm(126, 60, 20)]
    const times = marked(bpms, 0.008)
    times.push(times[times.length - 1] + 25)
    const pieces = detectTempoMap(times)
    expect(pieces[pieces.length - 1]).toEqual({ from: 60, to: 61, kind: 'asMarked' })
    const fit = fitTempoMap(times, pieces)
    expect(fit.times[60]).toBe(times[60])
    expect(fit.times[61]).toBe(times[61])
  })
})

describe('fitTempoMap', () => {
  it('is continuous: a ramp leaves a steady stretch at its tempo', () => {
    const bpms = [...Array(40).fill(120), ...bpm(120, 140, 16), ...Array(40).fill(140)]
    const times = marked(bpms, 0.008)
    const pieces: MapPiece[] = [
      { from: 0, to: 40, kind: 'steady' },
      { from: 40, to: 56, kind: 'ramp' },
      { from: 56, to: 96, kind: 'steady' },
    ]
    const fit = fitTempoMap(times, pieces)
    const tempo = (k: number) => 240 / (fit.times[k + 1] - fit.times[k])
    expect(tempo(39)).toBeCloseTo(tempo(20), 6)
    expect(Math.abs(tempo(40) - tempo(39))).toBeLessThan(1.5)
    expect(Math.abs(tempo(56) - tempo(55))).toBeLessThan(1.5)
    expect(fit.times[0]).toBe(times[0])
    expect(fit.times[96]).toBeCloseTo(times[96], 9)
    // Every bar within tapping distance of where it was made.
    const made = [0]
    bpms.forEach((b) => made.push(made[made.length - 1] + 240 / b))
    fit.times.forEach((t, k) => expect(Math.abs(t - made[k])).toBeLessThan(0.06))
  })

  it('takes a shape when it is given, and writes the rate', () => {
    const bpms = [...Array(30).fill(126), ...bpm(126, 60, 20)]
    const times = marked(bpms, 0.008)
    const base: MapPiece[] = [
      { from: 0, to: 30, kind: 'steady' },
      { from: 30, to: 50, kind: 'ramp' },
    ]
    const asBpm = fitTempoMap(times, [base[0], { ...base[1], shape: 'bpm' }]).segments[1]
    const asPct = fitTempoMap(times, [base[0], { ...base[1], shape: 'percent' }]).segments[1]
    expect(asBpm.shape).toBe('bpm')
    expect(rateText(asBpm)).toMatch(/^−3\.\d BPM\/bar$/)
    expect(asPct.shape).toBe('percent')
    expect(rateText(asPct)).toMatch(/^−\d\.\d%\/bar$/)
  })

  it('keeps the run’s ends where they are (rampsPlan, for Normalize)', () => {
    const bpms = [...pct(40, 126, 30), ...Array(40).fill(126)]
    const times = marked(bpms, 0.008)
    const plan = rampsPlan(times, detectTempoMap(times))
    expect(plan.times[0]).toBe(times[0])
    expect(plan.times[70]).toBe(times[70])
    expect(plan.moved).toBeGreaterThan(0)
  })
})
