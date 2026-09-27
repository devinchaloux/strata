import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDocument } from '@/lib/documentLoad'
import { exportFormDiagramSvg } from '@/widgets/form-diagram/exportSvg'

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
    const firstPhrase = hidden.data.spans.find((s) => s.label)?.label
    if (firstPhrase) expect(svg).not.toContain(`>${firstPhrase}<`)
  })

  it('scales a range to the requested width', async () => {
    const doc = alive()
    const svg = await exportFormDiagramSvg(doc, { start: 60, end: 120, width: 600, includeMarkers: false, includeAxis: true })
    expect(svg).toMatch(/width="632"/) // 600 + 16px padding each side
    expect(svg).toContain('>1:00<')
    expect(svg).toContain('>2:00<')
  })
})
