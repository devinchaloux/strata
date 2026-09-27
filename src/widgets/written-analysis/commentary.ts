/**
 * Written analysis — commentary anchored to the timeline. Pure functions; the
 * document store and the UI call through these.
 *
 * The design (docs/decisions.md, "Written Analysis Widget"): prose is anchored
 * to a span by id, or to a time range, and surfaces while its anchor plays.
 * Hierarchy lives in the writing and its [[slug]] links to other spans, not in
 * nested data. Text is never lost to an edit elsewhere: when a span goes away,
 * its commentary re-anchors (to the merged span, or to the time range the span
 * covered).
 */
import type {
  AnalysisBlock,
  BlockAnchor,
  PointMarker,
  Span,
  StrataDocument,
  WrittenAnalysisLayer,
} from '@/types/strata'
import { formSpans, analysisLayers } from '@/lib/layers'

/** Blank-line separator used when two pieces of commentary are combined. */
export const JOIN = '\n\n'

const allSpans = (doc: StrataDocument): Span[] => doc.layers.flatMap(formSpans)

/** The time range an anchor covers now, or null for a span that no longer exists. */
export function anchorRange(doc: StrataDocument, anchor: BlockAnchor): [number, number] | null {
  if ('spanId' in anchor) {
    const span = allSpans(doc).find((s) => s.id === anchor.spanId)
    return span ? [span.startTime, span.endTime] : null
  }
  return [anchor.start, anchor.end]
}

/** Every block in the document, with the layer that holds it. */
export function allBlocks(doc: StrataDocument): { layer: WrittenAnalysisLayer; block: AnalysisBlock }[] {
  return analysisLayers(doc).flatMap((layer) => layer.data.blocks.map((block) => ({ layer, block })))
}

/** The commentary attached to a span, if any. */
export function blockForSpan(doc: StrataDocument, spanId: string): AnalysisBlock | undefined {
  return allBlocks(doc).find(({ block }) => 'spanId' in block.anchor && block.anchor.spanId === spanId)?.block
}

/** Blocks whose anchor contains `time`, earliest-starting first. */
export function blocksAt(doc: StrataDocument, time: number): AnalysisBlock[] {
  return allBlocks(doc)
    .map(({ block }) => ({ block, range: anchorRange(doc, block.anchor) }))
    .filter(({ range }) => range && time >= range[0] && time < range[1])
    .sort((a, b) => a.range![0] - b.range![0])
    .map(({ block }) => block)
}

/** The document with a written-analysis layer, adding one ("Commentary") if it has none. */
function withAnalysisLayer(doc: StrataDocument, mkId: () => string): StrataDocument {
  if (analysisLayers(doc).length) return doc
  const commentary: WrittenAnalysisLayer = {
    id: mkId(),
    type: 'written-analysis',
    label: 'Commentary',
    visibility: true,
    locked: false,
    // Required by the layer envelope; a text layer doesn't draw with them.
    fillColorDefault: '#ffffff',
    strokeColorDefault: '#475569',
    // After every existing layer; text layers aren't part of the diagram's stack.
    displayOrder: Math.max(-1, ...doc.layers.map((l) => l.displayOrder)) + 1,
    data: { blocks: [] },
  }
  return { ...doc, layers: [...doc.layers, commentary] }
}

/**
 * Set (or clear, with empty text) the one block matching `find`, creating it
 * with `anchor` if there is none. Creates the document's written-analysis
 * layer on first use, so the analyst never has to add one by hand.
 */
function setBlock(
  doc: StrataDocument,
  find: (b: AnalysisBlock) => boolean,
  anchor: BlockAnchor,
  text: string,
  mkId: () => string,
): StrataDocument {
  const existing = allBlocks(doc).find(({ block }) => find(block))
  if (!existing && !text.trim()) return doc
  const withLayer = existing ? doc : withAnalysisLayer(doc, mkId)
  const target = existing?.layer ?? analysisLayers(withLayer)[0]
  const blocks = existing
    ? text.trim()
      ? target.data.blocks.map((b) => (b === existing.block ? { ...b, text } : b))
      : target.data.blocks.filter((b) => b !== existing.block)
    : [...target.data.blocks, { id: mkId(), anchor, text }]
  return {
    ...withLayer,
    layers: withLayer.layers.map((l) => (l.id === target.id ? { ...target, data: { blocks } } : l)),
  }
}

/** Set (or clear, with empty text) the commentary on a span. */
export function setSpanCommentary(
  doc: StrataDocument,
  spanId: string,
  text: string,
  mkId: () => string,
): StrataDocument {
  return setBlock(doc, (b) => 'spanId' in b.anchor && b.anchor.spanId === spanId, { spanId }, text, mkId)
}

const sameTime = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** The commentary anchored to exactly this stretch of time, if any. */
export function blockForRange(doc: StrataDocument, start: number, end: number): AnalysisBlock | undefined {
  return allBlocks(doc).find(
    ({ block: b }) => 'start' in b.anchor && sameTime(b.anchor.start, start) && sameTime(b.anchor.end, end),
  )?.block
}

/** Set (or clear, with empty text) the commentary on a stretch of time. */
export function setRangeCommentary(
  doc: StrataDocument,
  start: number,
  end: number,
  text: string,
  mkId: () => string,
): StrataDocument {
  return setBlock(
    doc,
    (b) => 'start' in b.anchor && sameTime(b.anchor.start, start) && sameTime(b.anchor.end, end),
    { start, end },
    text,
    mkId,
  )
}

/** Replace (or remove, with empty text) one block's text, whatever it's anchored to. */
export function setBlockText(doc: StrataDocument, blockId: string, text: string): StrataDocument {
  if (!allBlocks(doc).some(({ block }) => block.id === blockId)) return doc
  // The block exists, so setBlock only edits or removes; the anchor and id
  // arguments are never used.
  return setBlock(doc, (b) => b.id === blockId, { start: 0, end: 0 }, text, () => blockId)
}

/**
 * After an edit that removed spans, keep their commentary. A block whose span
 * vanished moves to the span that absorbed it (a merge records its sources in
 * `mergedFrom`), or else becomes a time-range block over the span's old times.
 * Two blocks landing on one span are combined, so a span keeps one commentary.
 * Returns `next` unchanged when nothing needed moving.
 */
export function reanchorOrphans(prev: StrataDocument, next: StrataDocument): StrataDocument {
  if (!analysisLayers(next).length) return next
  const liveIds = new Set(allSpans(next).map((s) => s.id))
  const prevSpans = new Map(allSpans(prev).map((s) => [s.id, s]))
  const heirOf = new Map<string, string>()
  for (const s of allSpans(next)) for (const src of s.mergedFrom ?? []) heirOf.set(src, s.id)

  let changed = false
  const layers = next.layers.map((layer) => {
    if (layer.type !== 'written-analysis') return layer
    const out: AnalysisBlock[] = []
    for (const block of layer.data.blocks) {
      let b = block
      if ('spanId' in block.anchor && !liveIds.has(block.anchor.spanId)) {
        changed = true
        const heir = heirOf.get(block.anchor.spanId)
        const old = prevSpans.get(block.anchor.spanId)
        b = heir
          ? { ...block, anchor: { spanId: heir } }
          : old
            ? { ...block, anchor: { start: old.startTime, end: old.endTime } }
            : block // unknown before and after: leave it for the analyst to see
      }
      // Combine with an earlier block already on the same span.
      const twin = 'spanId' in b.anchor ? out.find((o) => 'spanId' in o.anchor && o.anchor.spanId === (b.anchor as { spanId: string }).spanId) : undefined
      if (twin) {
        changed = true
        out[out.indexOf(twin)] = { ...twin, text: twin.text + JOIN + b.text }
      } else out.push(b)
    }
    return { ...layer, data: { blocks: out } }
  })
  return changed ? { ...next, layers } : next
}

// ── Text ────────────────────────────────────────────────────────────────────

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'link'; slug: string; value: string }

/**
 * Split commentary into paragraphs of inline pieces. Deliberately tiny: blank
 * lines separate paragraphs; **bold**, *italic*, and [[slug]] (or
 * [[slug|shown text]]) link to a span. Everything else is literal text.
 */
export function parseCommentary(text: string): Inline[][] {
  const pattern = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((para) => {
      const out: Inline[] = []
      let last = 0
      for (const m of para.matchAll(pattern)) {
        if (m.index! > last) out.push({ kind: 'text', value: para.slice(last, m.index) })
        if (m[1]) out.push({ kind: 'link', slug: m[1], value: m[2] ?? m[1] })
        else if (m[3]) out.push({ kind: 'bold', value: m[3] })
        else out.push({ kind: 'italic', value: m[4] })
        last = m.index! + m[0].length
      }
      if (last < para.length) out.push({ kind: 'text', value: para.slice(last) })
      return out
    })
}

/** The span a [[slug]] link names, if it exists. */
export function spanBySlug(doc: StrataDocument, slug: string): Span | undefined {
  return allSpans(doc).find((s) => s.slug === slug)
}

/** The point marker a [[slug]] link names, if it exists (spans and markers share slugs). */
export function markerBySlug(doc: StrataDocument, slug: string): PointMarker | undefined {
  return doc.pointMarkers.find((m) => m.slug === slug)
}

// ── HTML export ─────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** Every block in time order, with its span (if any), heading and range. */
function sections(doc: StrataDocument) {
  const spans = new Map(allSpans(doc).map((s) => [s.id, s]))
  return allBlocks(doc)
    .map(({ block }) => {
      const span = 'spanId' in block.anchor ? spans.get(block.anchor.spanId) : undefined
      const range = anchorRange(doc, block.anchor) ?? [0, 0]
      const heading = span ? span.label || span.type || 'Untitled span' : 'Passage'
      return { block, span, range, heading }
    })
    .sort((a, b) => a.range[0] - b.range[0])
}

/** Slugs of spans that have a section of their own, so links can point at it. */
function linkTargets(entries: ReturnType<typeof sections>): Set<string> {
  return new Set(entries.flatMap(({ span }) => (span?.slug ? [span.slug] : [])))
}

/**
 * The whole commentary as one readable HTML page, in time order, each section
 * headed by what it's about and when. [[slug]] links become in-page links to
 * that span's section when it has one. HTML is the default export for this
 * widget (docs/decisions.md): it opens anywhere, no markdown reader needed.
 */
export function commentaryToHtml(doc: StrataDocument): string {
  const entries = sections(doc)
  const targets = linkTargets(entries)

  const body = entries
    .map(({ block, span, range, heading }) => {
      const id = span?.slug ? ` id="${esc(span.slug)}"` : ''
      const paras = parseCommentary(block.text)
        .map(
          (p) =>
            '<p>' +
            p
              .map((piece) => {
                if (piece.kind === 'bold') return `<strong>${esc(piece.value)}</strong>`
                if (piece.kind === 'italic') return `<em>${esc(piece.value)}</em>`
                if (piece.kind === 'link') {
                  return targets.has(piece.slug) ? `<a href="#${esc(piece.slug)}">${esc(piece.value)}</a>` : esc(piece.value)
                }
                return esc(piece.value)
              })
              .join('') +
            '</p>',
        )
        .join('\n')
      return `<section${id}>\n<h2>${esc(heading)} <span class="time">${mmss(range[0])}–${mmss(range[1])}</span></h2>\n${paras}\n</section>`
    })
    .join('\n')

  const title = [doc.title, doc.artist.join(', ')].filter(Boolean).join(' — ')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{max-width:40rem;margin:3rem auto;padding:0 1rem;font:17px/1.6 Georgia,'Times New Roman',serif;color:#1d2330}
h1{font-size:1.6rem;margin-bottom:.2rem}
.meta{color:#5b6475;margin-top:0}
h2{font-size:1.1rem;margin:2rem 0 .4rem}
.time{font:500 .8rem ui-monospace,Menlo,monospace;color:#5b6475;margin-left:.4rem}
a{color:#1e6b73}
</style>
</head>
<body>
<h1>${esc(doc.title)}</h1>
<p class="meta">${esc(doc.artist.join(', '))}${doc.analysisAuthor ? ' · analysis by ' + esc(doc.analysisAuthor) : ''}</p>
${body}
</body>
</html>
`
}

// ── Markdown export ─────────────────────────────────────────────────────────

/**
 * The same document as Markdown, the secondary export for technical users
 * (docs/decisions.md). Each span section carries an `<a id>` anchor, since
 * Markdown renderers derive heading ids differently; [[slug]] links point at
 * it. The commentary's own **bold** and *italic* are already Markdown.
 */
export function commentaryToMarkdown(doc: StrataDocument): string {
  const entries = sections(doc)
  const targets = linkTargets(entries)
  const out: string[] = [`# ${doc.title}`]
  const meta = [doc.artist.join(', '), doc.analysisAuthor ? `analysis by ${doc.analysisAuthor}` : '']
    .filter(Boolean)
    .join(' · ')
  if (meta) out.push('', meta)
  for (const { block, span, range, heading } of entries) {
    out.push('')
    if (span?.slug) out.push(`<a id="${span.slug}"></a>`, '')
    out.push(`## ${heading} (${mmss(range[0])}–${mmss(range[1])})`)
    for (const para of parseCommentary(block.text)) {
      out.push(
        '',
        para
          .map((piece) =>
            piece.kind === 'bold'
              ? `**${piece.value}**`
              : piece.kind === 'italic'
                ? `*${piece.value}*`
                : piece.kind === 'link'
                  ? targets.has(piece.slug)
                    ? `[${piece.value}](#${piece.slug})`
                    : piece.value
                  : piece.value,
          )
          .join(''),
      )
    }
  }
  return out.join('\n') + '\n'
}
