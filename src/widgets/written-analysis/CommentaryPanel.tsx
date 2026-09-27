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
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisBlock, StrataDocument } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { anchorRange, blockForSpan, blocksAt, parseCommentary, spanBySlug, allBlocks } from './commentary'

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

function activeBlocks(doc: StrataDocument, time: number, selected: string[], playing: boolean): AnalysisBlock[] {
  if (!playing && selected.length === 1) {
    const own = blockForSpan(doc, selected[0])
    if (own) return [own]
  }
  return blocksAt(doc, time)
}

function Block({ doc, block }: { doc: StrataDocument; block: AnalysisBlock }) {
  const selectSpan = useUIStore((s) => s.selectSpan)
  const requestSeek = useUIStore((s) => s.requestSeek)
  const anchor = block.anchor
  const span = 'spanId' in anchor ? doc.layers.flatMap(formSpans).find((s) => s.id === anchor.spanId) : undefined
  const range = anchorRange(doc, block.anchor)
  const heading = span ? span.label || span.type || 'Untitled span' : 'Passage'

  function follow(slug: string) {
    const target = spanBySlug(doc, slug)
    if (!target) return
    selectSpan(target.id)
    requestSeek(target.startTime)
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
      </header>
      {parseCommentary(block.text).map((para, i) => (
        <p key={i} className="max-w-[65ch] text-[13.5px] leading-relaxed text-foreground">
          {para.map((piece, j) =>
            piece.kind === 'bold' ? (
              <strong key={j}>{piece.value}</strong>
            ) : piece.kind === 'italic' ? (
              <em key={j}>{piece.value}</em>
            ) : piece.kind === 'link' ? (
              spanBySlug(doc, piece.slug) ? (
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
                <span key={j} title={`No span has the slug "${piece.slug}"`}>
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

  if (!hasAny) {
    return (
      <p className="select-none text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
        Select a span and write in its Commentary box. It appears here while that passage plays.
      </p>
    )
  }

  const ids = activeKey ? activeKey.split(',') : []
  const blocks = allBlocks(doc)
    .map(({ block }) => block)
    .filter((b) => ids.includes(b.id))

  if (!blocks.length) {
    return (
      <p className="select-none text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
        No commentary for this passage.
      </p>
    )
  }
  return (
    <div className="flex w-full max-w-[42rem] flex-col gap-5 self-start px-4 py-4" aria-live="polite">
      {blocks.map((b) => (
        <Block key={b.id} doc={doc} block={b} />
      ))}
    </div>
  )
}
