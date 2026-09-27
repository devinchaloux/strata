/**
 * The JSON Schema is the published contract for the .strata format. These tests
 * hold both sides to it: the bundled files, and — more importantly — what the
 * app itself writes after real edits. A store action that produces a field the
 * schema doesn't allow (it uses additionalProperties: false) fails here instead
 * of in someone else's corpus script.
 */
import { formSpans } from '@/lib/layers'
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { useDocumentStore } from '@/store/documentStore'
import { readDocument } from '@/lib/documentLoad'
import { createEmptyDocument } from '@/lib/fileIO'
import { resolveMerge } from '@/lib/mergeSpans'

const schemaDir = resolve(__dirname, '../../schema')
const schema = JSON.parse(readFileSync(resolve(schemaDir, 'strata.schema.json'), 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)

/** Validates, and on failure shows the schema's complaints rather than just `false`. */
function expectValid(doc: unknown) {
  const ok = validate(doc)
  expect(ok ? [] : validate.errors?.map((e) => `${e.instancePath} ${e.message}`)).toEqual([])
}

const fixture = (name: string) => JSON.parse(readFileSync(resolve(schemaDir, name), 'utf8'))

describe('the JSON Schema', () => {
  it('accepts both bundled fixtures', () => {
    expectValid(fixture('alive.strata'))
    expectValid(fixture('example.strata'))
  })

  it('accepts a fresh document from New', () => {
    expectValid(createEmptyDocument())
  })
})

describe('documents the app writes', () => {
  const store = () => useDocumentStore.getState()
  const doc = () => JSON.parse(JSON.stringify(store().document)) // exactly what a save writes

  beforeEach(() => {
    store().loadDocument(readDocument(fixture('alive.strata')).doc)
  })

  it('stay valid after the common edits', () => {
    const layer = store().document!.layers[0]
    const [first, second] = formSpans(layer)

    store().placeBoundary(layer.id, (first.startTime + first.endTime) / 2) // split
    store().setSpanLabels([first.id], 'Intro′') // label + slug
    store().updateSpan(layer.id, first.id, {
      endBoundaryType: 'elided',
      endCap: 'elision',
      endOnTop: true,
      keyArea: '♭VI',
      confidence: 'approximate',
    })
    store().setSpanEdge(layer.id, second.id, 'end', second.endTime - 1) // numeric edge
    store().addPointMarker({
      id: crypto.randomUUID(),
      timestamp: 12.5,
      type: 'perfect-authentic-cadence',
      harmonicContext: 'V',
      kind: 'cadence',
      absent: true,
    })
    store().updateMeta({ homeKey: { tonic: 'B♭', mode: 'major' } })
    store().updateLayer(layer.id, { fontScale: 'lg' })

    expectValid(doc())
  })

  it('stay valid after a merge', () => {
    const layer = store().document!.layers[0]
    const sources = formSpans(layer).slice(0, 2)
    const { draft } = resolveMerge(sources, () => crypto.randomUUID())
    store().mergeSpans(layer.id, sources.map((s) => s.id), draft)
    expectValid(doc())
  })
})
