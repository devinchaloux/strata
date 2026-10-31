import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { migrate, FILE_FORMAT_VERSION, MIGRATIONS } from '@/lib/migrations'

describe('migrate', () => {
  it('leaves a current document unchanged', () => {
    const doc = { fileFormatVersion: FILE_FORMAT_VERSION, title: 'x' }
    expect(migrate(doc)).toBe(doc)
  })

  it('never downgrades a document from a newer format', () => {
    const doc = { fileFormatVersion: FILE_FORMAT_VERSION + 1, title: 'x' }
    expect(migrate(doc)).toBe(doc)
  })

  it('has a step for every version below the current one', () => {
    for (let v = 1; v < FILE_FORMAT_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function')
  })
})

/** Just enough shape to read the demo before and after migration. */
interface Loose {
  fileFormatVersion: number
  title: string
  sharedTimePoints?: unknown[]
  pointMarkers: { id: string }[]
  layers: { type: string; data: { spans?: { id: string; startTime: number; label?: string | null }[] } }[]
}

describe('format 1 → 2', () => {
  // The bundled demo is a real version-1 file with all three fields in use.
  const v1 = (): Loose => JSON.parse(readFileSync(resolve(__dirname, '../../public/demos/alive.strata'), 'utf8'))
  const up = (doc: Loose) => migrate(doc as unknown as Record<string, unknown>) as unknown as Loose
  const spans = (d: Loose) => d.layers.flatMap((l) => l.data.spans ?? []).map((s) => [s.id, s.startTime, s.label])

  it('drops the shared time points, hierarchicalEnforcement and confidence', () => {
    const before = v1()
    expect(before.fileFormatVersion).toBe(1)
    expect(before.sharedTimePoints?.length).toBeGreaterThan(0)
    const after = up(before)
    expect(after.fileFormatVersion).toBe(2)
    const text = JSON.stringify(after)
    expect(text).not.toContain('sharedTimePoints')
    expect(text).not.toContain('hierarchicalEnforcement')
    expect(text).not.toContain('"confidence"')
  })

  it('keeps everything else', () => {
    const before = v1()
    const after = up(before)
    expect(after.title).toBe(before.title)
    expect(after.pointMarkers.map((m) => m.id)).toEqual(before.pointMarkers.map((m) => m.id))
    expect(spans(after)).toEqual(spans(before))
  })

  it('leaves a layer it does not know untouched', () => {
    const layer = { id: 'x', type: 'energy-contour', data: { confidence: 'kept', hierarchicalEnforcement: true } }
    const after = migrate({ fileFormatVersion: 1, layers: [layer] }) as { layers: unknown[] }
    expect(after.layers[0]).toEqual(layer)
  })
})
