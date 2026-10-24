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
  commentaryToHtml,
  commentaryToMarkdown,
  markerBySlug,
  blockForRange,
  stackAt,
  passagesAt,
} from '@/widgets/written-analysis/commentary'
import { commentaryMarkdownHtml } from '@/widgets/written-analysis/commentaryHtml'
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
  const html = (text: string, slugs = ['drop', 'intro']) =>
    commentaryMarkdownHtml(text, (slug) => slugs.includes(slug), new Set(slugs))

  it('renders Markdown: paragraphs, emphasis, lists, headings, quotes, code', () => {
    const out = html('A **bold** and *soft* point.\n\n## Form\n\n- one\n- two\n\n1. first\n\n> quoted\n\nUse `code`.')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).toContain('<em>soft</em>')
    expect(out).toContain('<h2>Form</h2>')
    expect(out).toContain('<ul>')
    expect(out).toContain('<ol>')
    expect(out).toContain('<blockquote>')
    expect(out).toContain('<code>code</code>')
  })

  it('turns [[slug]] links into links to their sections, or plain text if nothing has the slug', () => {
    const out = html('See [[drop]], [[intro|the opening]] and [[gone]].')
    expect(out).toContain('<a href="#drop">drop</a>')
    expect(out).toContain('<a href="#intro">the opening</a>')
    expect(out).not.toContain('#gone')
    expect(out).toContain('gone')
  })

  it('shows angle brackets as typed, outside code and in it', () => {
    const out = html('The <tonic> returns; I < V. `a<b`')
    expect(out).toContain('The &lt;tonic&gt; returns; I &lt; V.')
    expect(out).toContain('<code>a&lt;b</code>')
  })

  it('opens other links in a new tab, and never renders raw HTML, scripts or images', () => {
    const out = html('[site](https://example.com) <b>raw</b><script>x()</script> ![pic](https://example.com/p.png) [bad](javascript:alert(1))')
    expect(out).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"')
    expect(out).not.toContain('<b>')
    expect(out).toContain('&lt;b&gt;raw') // shown as typed, not drawn
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('javascript:')
  })

  it('gives an unlabelled span no placeholder heading, only its time', async () => {
    store().updateSpans(['b'], { label: null })
    store().setSpanCommentary('b', 'A quiet bridge.')
    expect(await commentaryToHtml(doc())).toContain('<h2><span class="time">0:30–1:00</span></h2>')
    expect(commentaryToMarkdown(doc())).toContain('## (0:30–1:00)')
    expect(await commentaryToHtml(doc())).not.toContain('Untitled')
  })

  it('exports to HTML in time order, with links between sections and escaped text', async () => {
    store().setSpanCommentary('c', 'Echoes [[drop]].')
    store().setSpanCommentary('b', 'Loud <and> proud.')
    const html = await commentaryToHtml(doc())
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

describe('commentary on a stretch of time', () => {
  it('sets, edits and clears a range block, surfacing it while that stretch plays', () => {
    store().setRangeCommentary(10, 60, 'Across the intro and drop.')
    expect(blockForRange(doc(), 10, 60)?.text).toBe('Across the intro and drop.')
    expect(blocksAt(doc(), 40).map((b) => b.text)).toContain('Across the intro and drop.')
    store().setRangeCommentary(10, 60, 'Revised.')
    expect(analysisLayers(doc())[0].data.blocks).toHaveLength(1)
    store().setRangeCommentary(10, 60, '')
    expect(blockForRange(doc(), 10, 60)).toBeUndefined()
  })

  it('edits any block by id, and never creates one', () => {
    store().setSpanCommentary('b', 'Keep me')
    store().removeSpan('L', 'b') // now a range block over 30–60
    const block = analysisLayers(doc())[0].data.blocks[0]
    store().setCommentaryText(block.id, 'Edited orphan')
    expect(blockForRange(doc(), 30, 60)?.text).toBe('Edited orphan')
    store().setCommentaryText('no-such-block', 'x')
    expect(analysisLayers(doc())[0].data.blocks).toHaveLength(1)
    store().setCommentaryText(block.id, '')
    expect(analysisLayers(doc())[0].data.blocks).toHaveLength(0)
  })
})

describe('the stack at a moment', () => {
  it('lists the span sounding in each visible layer, top layer first, with its commentary', () => {
    const d = makeDoc([
      makeLayer('Phrases', [makeSpan('p1', 0, 15), makeSpan('p2', 15, 30)]),
      makeLayer('Rotations', [makeSpan('r1', 0, 60, { label: 'Rotation 1' })]),
    ])
    d.layers[0].displayOrder = 0
    d.layers[1].displayOrder = 5
    store().loadDocument(d)
    store().setSpanCommentary('r1', 'The first rotation.')
    store().setRangeCommentary(10, 20, 'Across the seam.')
    const rows = stackAt(doc(), 17)
    expect(rows.map((r) => r.span.id)).toEqual(['r1', 'p2'])
    expect(rows[0].block?.text).toBe('The first rotation.')
    expect(passagesAt(doc(), 17).map((b) => b.text)).toEqual(['Across the seam.'])
    expect(passagesAt(doc(), 25)).toEqual([])
  })

  it('skips hidden layers', () => {
    const d = makeDoc([makeLayer('A', [makeSpan('a', 0, 10)]), makeLayer('B', [makeSpan('b', 0, 10)])])
    d.layers[1].visibility = false
    store().loadDocument(d)
    expect(stackAt(doc(), 5).map((r) => r.span.id)).toEqual(['a'])
  })
})

describe('links to point markers', () => {
  it('resolve by slug, and export as plain text (a marker has no section)', async () => {
    store().addPointMarker({ id: 'mk', timestamp: 44, label: 'MC' })
    expect(markerBySlug(doc(), 'mc')?.id).toBe('mk')
    store().setSpanCommentary('b', 'After the [[mc]].')
    expect(await commentaryToHtml(doc())).toContain('After the mc.')
  })
})

describe('commentary in files', () => {
  it('round-trips through the reader and validates against the schema', () => {
    const fixture = JSON.parse(readFileSync(resolve(__dirname, '../../public/demos/alive.strata'), 'utf8'))
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
