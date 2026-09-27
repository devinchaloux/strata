/**
 * CommentaryPanel — the written-analysis widget's reading view.
 *
 * Sits in the open area above the form diagram and shows the commentary for
 * what's playing; while paused, a selected span with commentary takes over, so
 * the analyst can read or check what they wrote. A [[slug]] link selects that
 * span and moves playback to it.
 *
 * Playback runs at 60 fps, so this subscribes to *which* blocks are active (a
 * string key), not to the time itself: it re-renders when the playhead crosses
 * into a different passage, not every frame.
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisBlock, StrataDocument } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { anchorRange, blockForSpan, blockForRange, blocksAt, parseCommentary, spanBySlug, markerBySlug, allBlocks } from './commentary'

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

function activeBlocks(doc: StrataDocument, time: number, selected: string[], playing: boolean): AnalysisBlock[] {
  if (!playing && selected.length === 1) {
    const own = blockForSpan(doc, selected[0])
    if (own) return [own]
  }
  // Paused on a multi-selection: the commentary on the stretch it covers.
  if (!playing && selected.length > 1) {
    const spans = doc.layers.flatMap(formSpans).filter((s) => selected.includes(s.id))
    const stretch = spans.length
      ? blockForRange(doc, Math.min(...spans.map((s) => s.startTime)), Math.max(...spans.map((s) => s.endTime)))
      : undefined
    if (stretch) return [stretch]
  }
  return blocksAt(doc, time)
}

function Block({ doc, block }: { doc: StrataDocument; block: AnalysisBlock }) {
  // Commentary on a stretch of time has no span whose Inspector could edit
  // it (and a deleted span's commentary lands here), so it edits in place.
  const [editing, setEditing] = useState(false)
  const setCommentaryText = useDocumentStore((s) => s.setCommentaryText)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const requestSeek = useUIStore((s) => s.requestSeek)
  const anchor = block.anchor
  const span = 'spanId' in anchor ? doc.layers.flatMap(formSpans).find((s) => s.id === anchor.spanId) : undefined
  const range = anchorRange(doc, block.anchor)
  const heading = span ? span.label || span.type || 'Untitled span' : 'Passage'

  // A link goes to a span (selected, played from its start) or a point marker
  // (selected, played from its moment).
  function follow(slug: string) {
    const span = spanBySlug(doc, slug)
    if (span) {
      selectSpan(span.id)
      requestSeek(span.startTime)
      return
    }
    const marker = markerBySlug(doc, slug)
    if (marker) {
      selectPointMarker(marker.id)
      requestSeek(marker.timestamp)
    }
  }

  return (
    <article className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        {range && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {mmss(range[0])}–{mmss(range[1])}
          </span>
        )}
        {!span && (
          <button
            className="ml-auto text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </header>
      {editing && (
        <textarea
          autoFocus
          className="w-full resize-y rounded border border-border bg-card px-2 py-1 text-[13px] leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          rows={5}
          value={block.text}
          aria-label="Commentary on this passage"
          onChange={(e) => setCommentaryText(block.id, e.target.value)}
        />
      )}
      {!editing && parseCommentary(block.text).map((para, i) => (
        <p key={i} className="max-w-[65ch] text-[13.5px] leading-relaxed text-foreground">
          {para.map((piece, j) =>
            piece.kind === 'bold' ? (
              <strong key={j}>{piece.value}</strong>
            ) : piece.kind === 'italic' ? (
              <em key={j}>{piece.value}</em>
            ) : piece.kind === 'link' ? (
              spanBySlug(doc, piece.slug) || markerBySlug(doc, piece.slug) ? (
                <button
                  key={j}
                  className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                  onClick={() => follow(piece.slug)}
                  title={`Go to ${piece.slug}`}
                >
                  {piece.value}
                </button>
              ) : (
                // A link to a slug that doesn't exist (renamed, or a typo) reads as plain text.
                <span key={j} title={`Nothing has the slug "${piece.slug}"`}>
                  {piece.value}
                </span>
              )
            ) : (
              <span key={j}>{piece.value}</span>
            ),
          )}
        </p>
      ))}
    </article>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="max-w-md select-none text-center text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** What a new analysis needs next, in the order the work goes. */
function nextStep(doc: StrataDocument): string {
  const linked = !!doc.source.url || (doc.source.type === 'local' && !!doc.source.filename)
  if (!linked) return 'Link a video or audio file to start: use Link video or audio in the play bar.'
  if (!doc.layers.some((l) => formSpans(l).length > 0))
    return 'Play, and press Space at each boundary you hear. M places a point marker.'
  return 'Click a span to describe it. What you write in its Commentary box shows here while that passage plays.'
}

export function CommentaryPanel() {
  const doc = useDocumentStore((s) => s.document)
  // A string key of the active block ids: equal strings mean no re-render.
  const activeKey = useUIStore((s) =>
    doc
      ? activeBlocks(doc, s.currentTime, s.selectedSpanIds, s.playbackState === 'playing')
          .map((b) => b.id)
          .join(',')
      : '',
  )
  if (!doc) return null
  const hasAny = allBlocks(doc).length > 0

  // Until there's commentary, this space coaches the next step of a first
  // analysis instead: link a source, mark boundaries, then describe a span.
  if (!hasAny) return <Hint>{nextStep(doc)}</Hint>

  const ids = activeKey ? activeKey.split(',') : []
  const blocks = allBlocks(doc)
    .map(({ block }) => block)
    .filter((b) => ids.includes(b.id))

  if (!blocks.length) return <Hint>No commentary for this passage.</Hint>
  return (
    <div className="flex w-full max-w-[42rem] flex-col gap-5 self-start px-4 py-4" aria-live="polite">
      {blocks.map((b) => (
        <Block key={b.id} doc={doc} block={b} />
      ))}
    </div>
  )
}
