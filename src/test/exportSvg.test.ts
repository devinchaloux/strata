import { formSpans } from '@/lib/layers'
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDocument } from '@/lib/documentLoad'
import { exportFormDiagramSvg, cutLayerToRange } from '@/widgets/form-diagram/exportSvg'

const alive = () =>
  readDocument(JSON.parse(readFileSync(resolve(__dirname, '../../schema/alive.strata'), 'utf8'))).doc

const whole = (duration: number) => ({ start: 0, end: duration, width: 1200, includeMarkers: true, includeAxis: true })

describe('exportFormDiagramSvg', () => {
  it('produces a standalone SVG with the span labels, in literal colours', async () => {
    const doc = alive()
    const svg = await exportFormDiagramSvg(doc, whole(doc.duration))
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).toContain('Rotation 1')
    expect(svg).not.toContain('var(--') // no app stylesheet outside the app
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0)
  })

  it('leaves out hidden layers', async () => {
    const doc = alive()
    const hidden = doc.layers.find((l) => l.label === 'Phrases')!
    hidden.visibility = false
    const svg = await exportFormDiagramSvg(doc, whole(doc.duration))
    const firstPhrase = formSpans(hidden).find((s) => s.label)?.label
    if (firstPhrase) expect(svg).not.toContain(`>${firstPhrase}<`)
  })

  it('scales a range to the requested width', async () => {
    const doc = alive()
    const svg = await exportFormDiagramSvg(doc, { start: 60, end: 120, width: 600, includeMarkers: false, includeAxis: true })
    expect(svg).toMatch(/width="632"/) // 600 + 16px padding each side
    expect(svg).toContain('>1:00<')
    expect(svg).toContain('>2:00<')
  })

  it('draws the chosen layers, hidden or not', async () => {
    const doc = alive()
    const phrases = doc.layers.find((l) => l.label === 'Phrases')!
    const sections = doc.layers.find((l) => l.label === 'Sections')!
    phrases.visibility = false
    const svg = await exportFormDiagramSvg(doc, { ...whole(doc.duration), layerIds: [phrases.id] })
    expect(svg).toContain(`>${formSpans(phrases).find((s) => s.label)!.label}<`)
    expect(svg).not.toContain('>Verse 1<')
    expect(sections.visibility).toBe(true)
  })

  it('labels a span cut by the range at the part that shows', async () => {
    const doc = alive()
    // Rotation 1 runs 45–135: this range cuts it on both sides.
    const svg = await exportFormDiagramSvg(doc, { start: 100, end: 130, width: 600, includeMarkers: false, includeAxis: false })
    expect(svg).toContain('>Rotation 1<')
  })
})

describe('cutLayerToRange', () => {
  it('drops a layer with nothing in the range', () => {
    const doc = alive()
    const sections = doc.layers.find((l) => l.label === 'Sections')!
    expect(cutLayerToRange(sections, 0, 25, 10)).toBeNull()
  })

  it('trims cut spans square, past the edge, and moves the range to 0', () => {
    const doc = alive()
    const large = doc.layers.find((l) => l.label === 'Large-scale form')!
    const cut = cutLayerToRange(large, 100, 130, 20)!
    const spans = formSpans(cut)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ label: 'Rotation 1', startCap: 'square', endCap: 'square' })
    expect(spans[0].startTime).toBeLessThan(0)
    expect(spans[0].endTime).toBeGreaterThan(30)
  })
})
