import { describe, it, expect } from 'vitest'
import { blockShown, moveBlock, setBlockHidden, widgetBlocks } from '@/lib/widgets'
import { readDocument } from '@/lib/documentLoad'
import { useDocumentStore } from '@/store/documentStore'
import { tempoView, deviationRange, robustSpread } from '@/lib/tempoLane'
import type { Layer, Span, TempoLayer } from '@/types/strata'
import { makeDoc, makeLayer } from './fixtures'

const tempo = (sourceId = 'Bars', extra: Partial<TempoLayer['data']> = {}): TempoLayer =>
  ({ ...makeLayer('T'), type: 'tempo', data: { source: { layerId: sourceId, unit: 'bar' }, ...extra } }) as TempoLayer

describe('widgetBlocks', () => {
  it('is the Segments block alone for a file that lists none', () => {
    expect(widgetBlocks({ layers: [makeLayer('A')] })).toEqual([{ type: 'segmentation' }])
  })

  it('adds a tempo block below the Segments block when a tempo layer needs one, and drops duplicates', () => {
    expect(widgetBlocks({ layers: [tempo()] })).toEqual([{ type: 'segmentation' }, { type: 'tempo' }])
    expect(widgetBlocks({ widgets: [{ type: 'tempo' }, { type: 'segmentation' }, { type: 'tempo', hidden: true }], layers: [] })).toEqual([
      { type: 'tempo' },
      { type: 'segmentation' },
    ])
  })

  it('moves, hides and shows blocks', () => {
    const blocks = widgetBlocks({ layers: [tempo()] })
    expect(moveBlock(blocks, 'tempo', -1).map((w) => w.type)).toEqual(['tempo', 'segmentation'])
    expect(moveBlock(blocks, 'tempo', 1)).toBe(blocks)
    const hidden = setBlockHidden(blocks, 'tempo', true)
    expect(blockShown(hidden, 'tempo')).toBe(false)
    expect(setBlockHidden(hidden, 'tempo', false)[1]).toEqual({ type: 'tempo' })
  })
})

describe('reading a file', () => {
  it('reads a tempo layer and gives it a block', () => {
    const { doc } = readDocument(JSON.parse(JSON.stringify(makeDoc([makeLayer('Bars'), tempo()]))))
    expect(doc.layers[1].type).toBe('tempo')
    expect(doc.widgets).toEqual([{ type: 'segmentation' }, { type: 'tempo' }])
  })

  it('leaves a file without widgets without a list', () => {
    const { doc } = readDocument(JSON.parse(JSON.stringify(makeDoc([makeLayer('Bars')]))))
    expect(doc.widgets).toBeUndefined()
  })
})

describe('widgets in the store', () => {
  const store = () => useDocumentStore.getState()
  const bars: Span[] = [0, 2, 4, 6].map((t, k) => ({ id: `b${k}`, startTime: t, endTime: t + 2, label: String(k + 1) }))
  const load = (withBars = true) =>
    store().loadDocument(makeDoc([withBars ? ({ ...makeLayer('Bars', bars), role: 'bars' } as Layer) : makeLayer('Bars', bars)], { duration: 8 }))

  it('adds a tempo widget reading the bar layer, and needs one', () => {
    load(false)
    expect(store().addTempoWidget()).toBeNull()
    load()
    const id = store().addTempoWidget()!
    const layer = store().document!.layers.find((l) => l.id === id) as TempoLayer
    expect(layer.data.source).toEqual({ layerId: 'Bars', unit: 'bar' })
    expect(store().document!.widgets).toEqual([{ type: 'segmentation' }, { type: 'tempo' }])
  })

  it('moves, hides, shows and removes it, one undo step each', () => {
    load()
    store().addTempoWidget()
    store().moveWidget('tempo', -1)
    expect(store().document!.widgets!.map((w) => w.type)).toEqual(['tempo', 'segmentation'])
    store().setWidgetHidden('tempo', true)
    expect(store().document!.widgets![0].hidden).toBe(true)
    // Adding again shows the block that is there rather than making another.
    store().addTempoWidget()
    expect(store().document!.widgets![0].hidden).toBeUndefined()
    store().removeWidget('tempo')
    expect(store().document!.layers.some((l) => l.type === 'tempo')).toBe(false)
    expect(store().document!.widgets).toEqual([{ type: 'segmentation' }])
    useDocumentStore.temporal.getState().undo()
    expect(store().document!.layers.some((l) => l.type === 'tempo')).toBe(true)
    store().removeWidget('segmentation')
    expect(store().document!.widgets!.some((w) => w.type === 'segmentation')).toBe(true)
  })

  it('changes what the tempo shows and reads', () => {
    load()
    const id = store().addTempoWidget()!
    store().setTempoDisplay(id, { show: ['marked', 'deviation'], smoothing: 2 })
    store().setTempoDisplay(id, { smoothing: undefined })
    const layer = () => store().document!.layers.find((l) => l.id === id) as TempoLayer
    expect(layer().data.display).toEqual({ show: ['marked', 'deviation'] })
    store().setTempoSource(id, 'Other')
    expect(layer().data.source.layerId).toBe('Other')
  })
})

describe('tempoView', () => {
  // Bars around 2 s with tapping scatter: 120 BPM in 4/4.
  const taps = [0, 2.03, 3.98, 6.02, 7.99, 10.01, 12]
  const bars: Span[] = taps.slice(1).map((t, k) => ({ id: `b${k}`, startTime: taps[k], endTime: t }))
  const doc = (t: TempoLayer) => makeDoc([makeLayer('Bars', bars), t], { duration: 12 })

  it('draws the tempo as marked by default', () => {
    const v = tempoView(doc(tempo()), tempo())
    expect(v.marked).toHaveLength(6)
    expect(v.smoothed).toEqual([])
    expect(v.deviations).toEqual([])
  })

  it('smooths for the drawing only and measures each boundary against it', () => {
    const t = tempo('Bars', { display: { show: ['smoothed', 'deviation'], smoothing: 6 } })
    const v = tempoView(doc(t), t)
    expect(v.marked).toEqual([])
    v.smoothed.forEach((s) => expect(s.bpm).toBeCloseTo(120, 0))
    // Close to the scatter put in (the smoother fits a gentle curve, not a line).
    ;[30, -20, 20, -10, 10].forEach((ms, k) => expect(Math.abs(v.deviations[k].ms - ms)).toBeLessThan(10))
    expect(v.scatterMs).toBeGreaterThan(15)
    // Twice the scatter, out to 10.
    expect(deviationRange(v)).toBe(Math.ceil((v.scatterMs * 2) / 10) * 10)
    // The bars themselves are untouched.
    expect(bars[0].endTime).toBe(2.03)
  })

  it('keeps one far-off bar from swamping the scatter or the band', () => {
    const v = { deviations: [5, -4, 6, -5, 4, -6, 5, 5000].map((ms, k) => ({ time: k, ms })), scatterMs: robustSpread([5, -4, 6, -5, 4, -6, 5, 5000]) }
    expect(v.scatterMs).toBeLessThan(10)
    expect(deviationRange(v as never)).toBeLessThanOrEqual(40)
  })

  it('has nothing to draw when its source is gone', () => {
    const t = tempo('Gone')
    const v = tempoView(doc(t), t)
    expect(v.source).toBeNull()
    expect(v.marked).toEqual([])
  })
})
