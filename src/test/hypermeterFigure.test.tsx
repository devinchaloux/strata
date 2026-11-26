// @vitest-environment jsdom
/**
 * How a span's hypermeter is drawn (widgets/segmentation/figure.tsx): centered
 * inside the span, apart from its annotation, shown or hidden by the layer and
 * by the span (docs/decisions.md, "The Hypermeter Is Its Own Field").
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LayerFigure } from '@/widgets/segmentation/figure'
import { PRINT_THEME } from '@/widgets/segmentation/theme'
import type { Layer, Span } from '@/types/strata'
import { makeLayer } from './fixtures'

const span = (extra: Partial<Span> = {}): Span => ({ id: 'a', startTime: 0, endTime: 20, ...extra })

/** The texts drawn, each with where it sits. */
function drawn(layer: Layer) {
  const svg = renderToStaticMarkup(
    <svg>
      <LayerFigure layer={layer} topY={0} pps={10} totalWidth={200} theme={PRINT_THEME} />
    </svg>,
  )
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  return [...doc.querySelectorAll('text')].map((t) => ({
    text: t.textContent,
    x: Number(t.getAttribute('x')),
    y: Number(t.getAttribute('y')),
    anchor: t.getAttribute('text-anchor'),
  }))
}

describe('the hypermeter on the diagram', () => {
  it('is drawn centered in the span, and an annotation keeps its own place on the line', () => {
    const texts = drawn(makeLayer('L', [span({ hypermeter: { count: 4, becomes: 1 }, annotation: 'Hook' })]))
    const count = texts.find((t) => t.text === '4=1')!
    const note = texts.find((t) => t.text === 'Hook')!
    expect(count.anchor).toBe('middle')
    expect(count.x).toBe(100)
    expect(note.y).toBe(count.y)
    expect(note.x).toBeLessThan(count.x)
  })

  it('puts the annotation on its own line below when the layer asks', () => {
    const layer = { ...makeLayer('L', [span({ hypermeter: { count: 2 }, annotation: 'Hook' })]), rendering: { hypermeterLine: 'own' as const } }
    const texts = drawn(layer)
    expect(texts.find((t) => t.text === 'Hook')!.y).toBeGreaterThan(texts.find((t) => t.text === '2')!.y)
  })

  it('hides for the layer, and a span can still show its own', () => {
    const layer = { ...makeLayer('L', [span({ hypermeter: { count: 1 } }), span({ id: 'b', startTime: 20, endTime: 40, hypermeter: { count: 2 }, showHypermeter: true })]), showHypermeter: false }
    expect(drawn(layer).map((t) => t.text)).toEqual(['2'])
  })

  it('hides on one span while its layer shows the rest', () => {
    const layer = makeLayer('L', [span({ hypermeter: { count: 1 }, showHypermeter: false }), span({ id: 'b', startTime: 20, endTime: 40, hypermeter: { count: 2 } })])
    expect(drawn(layer).map((t) => t.text)).toEqual(['2'])
  })
})
