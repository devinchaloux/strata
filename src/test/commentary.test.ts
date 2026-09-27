import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { useDocumentStore } from '@/store/documentStore'
import { readDocument } from '@/lib/documentLoad'
import { analysisLayers } from '@/lib/layers'
import {
  blockForSpan,
  blocksAt,
  parseCommentary,
  commentaryToHtml,
  commentaryToMarkdown,
  markerBySlug,
} from '@/widgets/written-analysis/commentary'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const store = () => useDocumentStore.getState()
const doc = () => store().document!

beforeEach(() => {
  store().loadDocument(
    makeDoc([
      makeLayer('L', [
        makeSpan('a', 0, 30, { label: 'Intro', slug: 'intro' }),
        makeSpan('b', 30, 60, { label: 'Drop', slug: 'drop' }),
        makeSpan('c', 60, 100, { label: 'Outro', slug: 'outro' }),
      ]),
    ]),
  )
})

describe('span commentary', () => {
  it('creates the commentary layer on first use, and clears with empty text', () => {
    expect(analysisLayers(doc())).toHaveLength(0)
    store().setSpanCommentary('b', 'The drop lands on the downbeat.')
    expect(analysisLayers(doc())).toHaveLength(1)
    expect(blockForSpan(doc(), 'b')?.text).toBe('The drop lands on the downbeat.')
    store().setSpanCommentary('b', '')
    expect(blockForSpan(doc(), 'b')).toBeUndefined()
  })

  it('surfaces the commentary for whatever is playing', () => {
    store().setSpanCommentary('b', 'Drop text')
    expect(blocksAt(doc(), 45).map((b) => b.text)).toEqual(['Drop text'])
    expect(blocksAt(doc(), 10)).toEqual([])
  })

  it('keeps commentary when its span is deleted, anchored to the old times', () => {
    store().setSpanCommentary('b', 'Keep me')
    store().removeSpan('L', 'b')
    const block = analysisLayers(doc())[0].data.blocks[0]
    expect(block.text).toBe('Keep me')
    expect(block.anchor).toEqual({ start: 30, end: 60 })
  })

  it('moves commentary to a merged span, combining two pieces', () => {
    store().setSpanCommentary('a', 'First')
    store().setSpanCommentary('b', 'Second')
    store().mergeSpans('L', ['a', 'b'], makeSpan('m', 0, 60, { mergedFrom: ['a', 'b'] }))
    expect(blockForSpan(doc(), 'm')?.text).toBe('First\n\nSecond')
    expect(analysisLayers(doc())[0].data.blocks).toHaveLength(1)
  })

  it('keeps commentary on the original span when it is split', () => {
    store().setSpanCommentary('b', 'Stays')
    store().placeBoundary('L', 45)
    expect(blockForSpan(doc(), 'b')?.text).toBe('Stays')
  })
})

describe('commentary text', () => {
  it('parses paragraphs, emphasis and span links', () => {
    expect(parseCommentary('A **bold** and *soft* point.\n\nSee [[drop]] and [[intro|the opening]].')).toEqual([
      [
        { kind: 'text', value: 'A ' },
        { kind: 'bold', value: 'bold' },
        { kind: 'text', value: ' and ' },
        { kind: 'italic', value: 'soft' },
        { kind: 'text', value: ' point.' },
      ],
      [
        { kind: 'text', value: 'See ' },
        { kind: 'link', slug: 'drop', value: 'drop' },
        { kind: 'text', value: ' and ' },
        { kind: 'link', slug: 'intro', value: 'the opening' },
        { kind: 'text', value: '.' },
      ],
    ])
  })

  it('exports to HTML in time order, with links between sections and escaped text', () => {
    store().setSpanCommentary('c', 'Echoes [[drop]].')
    store().setSpanCommentary('b', 'Loud <and> proud.')
    const html = commentaryToHtml(doc())
    expect(html.indexOf('Drop')).toBeLessThan(html.indexOf('Outro'))
    expect(html).toContain('<section id="drop">')
    expect(html).toContain('<a href="#drop">drop</a>')
    expect(html).toContain('Loud &lt;and&gt; proud.')
  })

  it('exports to Markdown with anchors, links and emphasis', () => {
    store().setSpanCommentary('c', 'Echoes [[drop]] and [[nowhere]].')
    store().setSpanCommentary('b', 'A **big** drop.')
    const md = commentaryToMarkdown(doc())
    expect(md).toContain('<a id="drop"></a>\n\n## Drop (0:30–1:00)\n\nA **big** drop.')
    expect(md).toContain('Echoes [drop](#drop) and nowhere.')
    expect(md.indexOf('## Drop')).toBeLessThan(md.indexOf('## Outro'))
  })
})

describe('links to point markers', () => {
  it('resolve by slug, and export as plain text (a marker has no section)', () => {
    store().addPointMarker({ id: 'mk', timestamp: 44, label: 'MC' })
    expect(markerBySlug(doc(), 'mc')?.id).toBe('mk')
    store().setSpanCommentary('b', 'After the [[mc]].')
    expect(commentaryToHtml(doc())).toContain('After the mc.')
  })
})

describe('commentary in files', () => {
  it('round-trips through the reader and validates against the schema', () => {
    const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../schema/alive.strata'), 'utf8'))
    store().loadDocument(readDocument(fixture).doc)
    const span = doc().layers.flatMap((l) => (l.type === 'form-diagram' ? l.data.spans : []))[0]
    store().setSpanCommentary(span.id, 'An analytical remark.')
    store().removeLayer(doc().layers.find((l) => l.type === 'form-diagram')!.id)

    const saved = JSON.parse(JSON.stringify(doc()))
    const schema = JSON.parse(readFileSync(resolve(__dirname, '../../schema/strata.schema.json'), 'utf8'))
    const ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(ajv)
    const validate = ajv.compile(schema)
    expect(validate(saved) ? [] : validate.errors).toEqual([])

    const reread = readDocument(saved)
    expect(reread.notices).toEqual([])
    expect(analysisLayers(reread.doc)[0].data.blocks[0].text).toBe('An analytical remark.')
  })
})
