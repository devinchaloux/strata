import { describe, it, expect } from 'vitest'
import { onlyLayers, parseEmbedParams, parseTimeRange, readCommand, resolveFocus, viewAround } from '@/lib/embed'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const doc = () => {
  const d = makeDoc([
    makeLayer('form', [makeSpan('a', 0, 30, { slug: 'intro' }), makeSpan('b', 30, 90, { slug: 'drop-1' })]),
    makeLayer('phr', [makeSpan('c', 0, 10)]),
  ])
  d.layers[0].label = 'Sections'
  d.layers[1].label = 'Phrases'
  d.duration = 120
  return d
}

describe('parseEmbedParams', () => {
  it('reads the file, focus and layers', () => {
    const p = parseEmbedParams('https://s.example/?embed&src=https%3A%2F%2Fx.example%2Fa.strata&focus=drop-1&layers=Sections,%20Phrases')
    expect(p).toEqual({ src: 'https://x.example/a.strata', focus: 'drop-1', layers: ['Sections', 'Phrases'], bare: false })
    expect(parseEmbedParams('https://s.example/?embed&bare&src=https%3A%2F%2Fx.example%2Fa.strata')?.bare).toBe(true)
  })

  it('is null without embed, or without a usable file', () => {
    expect(parseEmbedParams('https://s.example/?src=https%3A%2F%2Fx.example%2Fa.strata')).toBeNull()
    expect(parseEmbedParams('https://s.example/?embed')).toBeNull()
    expect(parseEmbedParams('https://s.example/?embed&src=javascript%3Aalert(1)')).toBeNull()
  })
})

describe('focus', () => {
  it('reads time ranges in m:ss or seconds', () => {
    expect(parseTimeRange('1:04-1:30')).toEqual([64, 90])
    expect(parseTimeRange('64 – 90.5')).toEqual([64, 90.5])
    expect(parseTimeRange('1:30-1:04')).toBeNull()
    expect(parseTimeRange('drop-1')).toBeNull()
  })

  it('resolves a span slug or a range', () => {
    expect(resolveFocus(doc(), 'drop-1')).toEqual({ start: 30, end: 90, spanId: 'b' })
    expect(resolveFocus(doc(), '1:00-3:00')).toEqual({ start: 60, end: 120, spanId: null })
    expect(resolveFocus(doc(), 'nothing')).toBeNull()
  })

  it('shows the focus with a margin, inside the track', () => {
    expect(viewAround({ start: 30, end: 90, spanId: null }, 120)).toEqual([21, 99])
    expect(viewAround({ start: 0, end: 100, spanId: null }, 110)).toEqual([0, 110])
  })
})

describe('onlyLayers', () => {
  it('shows only the named layers, by label or id', () => {
    expect(onlyLayers(doc(), ['phrases']).layers.map((l) => l.visibility)).toEqual([false, true])
    expect(onlyLayers(doc(), ['form']).layers.map((l) => l.visibility)).toEqual([true, false])
  })

  it('leaves the document alone when no name matches', () => {
    const d = doc()
    expect(onlyLayers(d, ['Nope'])).toBe(d)
  })
})

describe('readCommand', () => {
  it('accepts the page’s commands and nothing else', () => {
    expect(readCommand({ type: 'strata:cue', focus: 'drop-1', play: true })).toEqual({ type: 'strata:cue', focus: 'drop-1', play: true })
    expect(readCommand({ type: 'strata:pause' })).toEqual({ type: 'strata:pause' })
    expect(readCommand({ type: 'strata:cue' })).toBeNull()
    expect(readCommand('strata:play')).toBeNull()
    expect(readCommand(null)).toBeNull()
  })
})
