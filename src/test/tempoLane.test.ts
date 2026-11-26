import { describe, it, expect } from 'vitest'
import { beatsPerBarAt, tempoLane, tempoScale, tempoSteps, tempoSummary, tempoY, TEMPO_LANE_HEIGHT, TEMPO_PAD_BOTTOM, TEMPO_PAD_TOP } from '@/lib/tempoLane'
import type { Layer, Span } from '@/types/strata'
import { makeDoc, makeLayer } from './fixtures'

const bar = (k: number, start: number, end: number): Span => ({ id: `b${k}`, startTime: start, endTime: end, label: String(k + 1) })
// Bars of 2s, then 1.5s: 120 then 160 BPM in 4/4.
const bars = [bar(0, 0, 2), bar(1, 2, 4), bar(2, 4, 5.5), bar(3, 5.5, 7)]
const barLayer = (extra: Partial<Layer> = {}): Layer => ({ ...makeLayer('Bars', bars), role: 'bars', ...extra }) as Layer

describe('tempoSteps', () => {
  it('reads each bar\'s tempo from its length', () => {
    const steps = tempoSteps(barLayer(), () => 4)
    expect(steps.map((s) => s.bpm)).toEqual([120, 120, 160, 160])
    expect(steps[2].bar).toBe('3')
  })

  it('takes the meter from the grid, else the document, else 4', () => {
    const doc = makeDoc([], { duration: 10, timeSignature: { numerator: 3, denominator: 4 }, beatGrid: [{ id: 'g', start: 5, bpm: 100, beatsPerBar: 6 }] })
    const at = beatsPerBarAt(doc)
    expect(at(1)).toBe(3)
    expect(at(6)).toBe(6)
    expect(beatsPerBarAt(makeDoc([]))(1)).toBe(4)
  })
})

describe('tempoScale', () => {
  it('runs from the lowest to the highest out to the nearest 10, with a middle guide when there is room', () => {
    expect(tempoScale([{ start: 0, end: 1, bpm: 30.1, bar: null }, { start: 1, end: 2, bpm: 126, bar: null }])).toEqual({ min: 30, max: 130, ticks: [30, 80, 130] })
    expect(tempoScale([{ start: 0, end: 1, bpm: 125, bar: null }, { start: 1, end: 2, bpm: 126, bar: null }]).ticks).toEqual([120, 130])
  })

  it('puts the highest tempo at the top of the lane and the lowest at the bottom', () => {
    const scale = { min: 100, max: 200, ticks: [100, 200] }
    expect(tempoY(200, scale, 10)).toBe(10 + TEMPO_PAD_TOP)
    expect(tempoY(100, scale, 10)).toBe(10 + TEMPO_LANE_HEIGHT - TEMPO_PAD_BOTTOM)
  })
})

describe('tempoLane', () => {
  it('reads a layer of bars, and needs two', () => {
    const doc = makeDoc([barLayer()], { duration: 7 })
    expect(tempoLane(doc, barLayer())?.steps).toHaveLength(4)
    expect(tempoLane(doc, { ...barLayer(), data: { spans: [bars[0]] } } as Layer)).toBeNull()
  })

  it('cuts to a range for export, keeping each bar\'s whole-bar tempo', () => {
    const lane = tempoLane(makeDoc([barLayer()], { duration: 7 }), barLayer(), { start: 3, end: 6 })!
    expect(lane.steps.map((s) => [s.start, s.end, s.bpm])).toEqual([[0, 1, 120], [1, 2.5, 160], [2.5, 3, 160]])
  })
})

describe('tempoSummary', () => {
  const layerOf = (lengths: number[]): Layer => {
    let t = 0
    const spans = lengths.map((len, k) => {
      const s = { id: `b${k}`, startTime: t, endTime: t + len }
      t += len
      return s
    })
    return { ...makeLayer('Bars', spans), role: 'bars' } as Layer
  }
  // Steady 120 BPM with up to ±30 ms of tapping scatter at the boundaries.
  const scatter = [0.02, -0.03, 0.01, 0.03, -0.02, 0, 0.02, -0.01, -0.03, 0.02]
  const steady = Array.from({ length: 40 }, (_, k) => 2 + (scatter[(k + 1) % 10] - scatter[k % 10]))

  it('calls a steady track steady, tapping scatter and all', () => {
    const s = tempoSummary(makeDoc([], { duration: 200 }), layerOf(steady))!
    expect(s.moves).toBe(false)
    expect(s.median).toBeCloseTo(120, 0)
  })

  it('is not fooled by one long last bar holding a fade', () => {
    const s = tempoSummary(makeDoc([], { duration: 200 }), layerOf([...steady, 12]))!
    expect(s.moves).toBe(false)
  })

  it('sees an accelerando', () => {
    const accel = Array.from({ length: 40 }, (_, k) => 4 * 0.97 ** k)
    const s = tempoSummary(makeDoc([], { duration: 200 }), layerOf(accel))!
    expect(s.moves).toBe(true)
    expect(s.high - s.low).toBeGreaterThan(50)
  })
})
