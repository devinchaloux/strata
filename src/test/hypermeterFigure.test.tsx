// @vitest-environment jsdom
/**
 * How a span's hypermeter is drawn (widgets/segmentation/figure.tsx): centered
 * inside the span, apart from its annotation, shown or hidden by the layer and
 * by the span (docs/decisions.md, "The Hypermeter Is Its Own Field").
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LayerFigure, SegmentationFigure } from '@/widgets/segmentation/figure'
import { SHAPE_HEIGHT, STRIP_HEIGHT, STRIP_LABEL_ROOM, stackHeight, layerPitch, shapeTopY } from '@/lib/segmentShape'
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
    size: Number(t.getAttribute('font-size')),
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

  it('draws the hypermeter, or the annotation, in a strip under the layer, and the other keeps its place inside', () => {
    const with_ = (underneath: 'hypermeter' | 'annotation') => ({
      ...makeLayer('L', [span({ hypermeter: { count: 2 }, annotation: 'Hook' })]),
      rendering: { underneath },
    })
    const inside = drawn(makeLayer('L', [span({ hypermeter: { count: 2 }, annotation: 'Hook' })]))
    const below = drawn(with_('hypermeter'))
    expect(below.find((t) => t.text === '2')!.y).toBeGreaterThan(SHAPE_HEIGHT)
    expect(below.find((t) => t.text === 'Hook')!.y).toBe(inside.find((t) => t.text === 'Hook')!.y)
    const noteBelow = drawn(with_('annotation'))
    expect(noteBelow.find((t) => t.text === 'Hook')!.y).toBeGreaterThan(SHAPE_HEIGHT)
    expect(noteBelow.find((t) => t.text === '2')!.y).toBe(inside.find((t) => t.text === '2')!.y)
  })

  it('orders bracket, strip, the next layer\'s labels, its spans', () => {
    const above = { ...makeLayer('A', [span({ hypermeter: { count: 1 } })], 1), rendering: { underneath: 'hypermeter' as const } }
    const below = makeLayer('B', [span({ id: 'b', label: 'Verse' })], 0)
    expect(layerPitch(above)).toBe(layerPitch(below) + STRIP_HEIGHT + STRIP_LABEL_ROOM)
    const label = (layers: Layer[]) => {
      const svg = renderToStaticMarkup(
        <svg>
          <SegmentationFigure layers={layers} placements={[]} pps={10} totalWidth={200} showCaptions={false} theme={PRINT_THEME} />
        </svg>,
      )
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const text = [...doc.querySelectorAll('text')].find((t) => t.textContent === 'Verse')!
      // Its height on the page: its own y plus every enclosing translate's.
      let y = Number(text.getAttribute('y'))
      for (let el = text.parentElement; el; el = el.parentElement) {
        const m = /translate\([^,]+,\s*([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '')
        if (m) y += Number(m[1])
      }
      return y
    }
    const plain = { ...above, rendering: {} }
    const layers = [above, below]
    // The label below the strip's bottom, and as far above its own spans as without a strip.
    const stripBottom = shapeTopY(layers, 0) + SHAPE_HEIGHT + STRIP_HEIGHT
    expect(label(layers) - 11 * 0.8).toBeGreaterThan(stripBottom)
    expect(shapeTopY(layers, 1) - label(layers)).toBe(shapeTopY([plain, below], 1) - label([plain, below]))
    expect(stackHeight(layers)).toBe(stackHeight([plain, below]) + STRIP_HEIGHT + STRIP_LABEL_ROOM)
  })

  it('hides for the layer, and a span can still show its own', () => {
    const layer = { ...makeLayer('L', [span({ hypermeter: { count: 1 } }), span({ id: 'b', startTime: 20, endTime: 40, hypermeter: { count: 2 }, showHypermeter: true })]), showHypermeter: false }
    expect(drawn(layer).map((t) => t.text)).toEqual(['2'])
  })

  it('hides on one span while its layer shows the rest', () => {
    const layer = makeLayer('L', [span({ hypermeter: { count: 1 }, showHypermeter: false }), span({ id: 'b', startTime: 20, endTime: 40, hypermeter: { count: 2 } })])
    expect(drawn(layer).map((t) => t.text)).toEqual(['2'])
  })

  it('draws a count smaller rather than leave it out on a narrow span, and leaves it out when even that won\'t fit', () => {
    const narrow = (end: number) => makeLayer('L', [span({ endTime: end, startCap: 'square', endCap: 'square', hypermeter: { count: 4, becomes: 1 } })])
    const [shrunk] = drawn(narrow(2.4))
    expect(shrunk.text).toBe('4=1')
    expect(shrunk.size).toBeLessThan(9)
    expect(shrunk.size).toBeGreaterThanOrEqual(9 * 0.7)
    expect(drawn(narrow(1.2))).toEqual([])
  })
})
