import { describe, it, expect } from 'vitest'
import { autoLogLambda, normalizePlan, runTimes, scatter, smoothTimes, steadyTimes } from '@/lib/normalize'
import { formSpans } from '@/lib/layers'
import { useDocumentStore } from '@/store/documentStore'
import type { Span } from '@/types/strata'
import { makeDoc, makeLayer } from './fixtures'

// A steady 2-second bar with tapping scatter of up to ±40 ms, fixed pattern.
const jitter = [0, 0.03, -0.04, 0.02, -0.01, 0.04, -0.03, 0.01, -0.02, 0.03, 0]
const steady = jitter.map((e, k) => k * 2 + e)

describe('steadyTimes', () => {
  it('makes every bar the same length between the two ends', () => {
    expect(steadyTimes([0, 1.9, 4.2, 6])).toEqual([0, 2, 4, 6])
  })
})

describe('smoothTimes', () => {
  it('keeps the ends exactly and pulls the inner boundaries toward a smooth curve', () => {
    const out = smoothTimes(steady, 1e4)
    expect(out[0]).toBe(steady[0])
    expect(out[10]).toBe(steady[10])
    out.forEach((t, k) => expect(t).toBeCloseTo(k * 2, 1))
  })

  it('follows an accelerando rather than flattening it', () => {
    // Bars shrinking 5% each: a smooth tempo rise, with no scatter.
    const times = [0]
    for (let k = 0; k < 20; k++) times.push(times[k] + 4 * 0.95 ** k)
    const out = smoothTimes(times, 10)
    out.forEach((t, k) => expect(Math.abs(t - times[k])).toBeLessThan(0.02))
  })

  it('leaves too short a run alone', () => {
    expect(smoothTimes([0, 1, 2], 10)).toEqual([0, 1, 2])
  })
})

describe('autoLogLambda', () => {
  it('smooths a steady tempo with scatter until the scatter is gone', () => {
    const plan = normalizePlan(steady, 'smooth', autoLogLambda(steady))
    expect(plan.scatter).toBeGreaterThan(0.015)
    plan.times.forEach((t, k) => expect(Math.abs(t - k * 2)).toBeLessThan(0.025))
  })
})

describe('normalizePlan', () => {
  it('says how many boundaries move and how far', () => {
    const plan = normalizePlan(steady, 'steady', 0)
    expect(plan.moved).toBe(9)
    expect(plan.maxMove).toBeCloseTo(0.04)
    expect(scatter(steady, plan.times)).toBeCloseTo(plan.scatter)
  })
})

describe('runTimes', () => {
  it('gives the boundaries of spans that follow one another, else null', () => {
    expect(runTimes([{ startTime: 2, endTime: 3 }, { startTime: 0, endTime: 2 }])).toEqual([0, 2, 3])
    expect(runTimes([{ startTime: 0, endTime: 1 }, { startTime: 2, endTime: 3 }])).toBeNull()
  })
})

describe('normalizeBars in the store', () => {
  const store = () => useDocumentStore.getState()
  const sp = (id: string, startTime: number, endTime: number, extra: Partial<Span> = {}): Span => ({ id, startTime, endTime, ...extra })
  const layer = (id: string) => store().document!.layers.find((l) => l.id === id)!
  // Six tapped bars, uneven, under two phrases of three bars; the middle
  // boundary (t = 6.1) is both a bar boundary and the phrases'.
  const taps = [0, 1.9, 4.1, 6.1, 7.9, 10.05, 12]
  function load() {
    const bars = taps.slice(1).map((t, k) => sp(`b${k}`, taps[k], t, { label: String(k + 1), annotation: String((k % 3) + 1), parentId: k < 3 ? 'p1' : 'p2' }))
    store().loadDocument({
      ...makeDoc([{ ...makeLayer('Bars', bars, 0), role: 'bars' as const }, makeLayer('Phrases', [sp('p1', 0, 6.1), sp('p2', 6.1, 12)], 1)]),
      duration: 12,
    })
  }

  it('evens the bars in place, and the phrase boundary on a bar boundary follows', () => {
    load()
    const r = store().normalizeBars(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'], 'steady', 0, false)
    expect(r?.moved).toBe(5)
    expect(formSpans(layer('Bars')).map((s) => s.startTime)).toEqual([0, 2, 4, 6, 8, 10])
    expect(formSpans(layer('Phrases'))[0].endTime).toBe(6)
    useDocumentStore.temporal.getState().undo()
    expect(formSpans(layer('Bars')).map((s) => s.startTime)).toEqual(taps.slice(0, -1))
  })

  it('copies the bars, normalized, to a layer below, keeping the taps', () => {
    load()
    const r = store().normalizeBars(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'], 'steady', 0, true)
    const copy = layer(r!.layerId)
    expect(copy.label).toBe('Bars (normalized)')
    expect(copy.displayOrder).toBeLessThan(layer('Bars').displayOrder)
    expect(formSpans(copy).map((s) => [s.startTime, s.label, s.annotation])).toEqual([
      [0, '1', '1'], [2, '2', '2'], [4, '3', '3'], [6, '4', '1'], [8, '5', '2'], [10, '6', '3'],
    ])
    expect(formSpans(layer('Bars')).map((s) => s.startTime)).toEqual(taps.slice(0, -1))
  })

  it('refuses bars that do not follow one another', () => {
    load()
    expect(store().normalizeBars(['b0', 'b2'], 'steady', 0, false)).toBeNull()
  })
})
