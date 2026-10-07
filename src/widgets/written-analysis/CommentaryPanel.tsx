/**
 * CommentaryPanel — the written-analysis widget's reading view.
 *
 * Sits in the open area above the form diagram and shows the moment as a
 * stack: in each layer from the top down (rotation → section → phrase), the
 * span sounding now, with its label, annotation and commentary, and its lyrics
 * when the Lyrics toggle is on. Commentary on a stretch of time covering the
 * moment comes first. While paused with spans selected, the moment is where
 * the selection begins, so the analyst can read the context of what they
 * picked. A [[slug]] link selects that span or marker and moves playback to it.
 *
 * Playback runs at 60 fps, so this subscribes to *which* spans and blocks make
 * up the stack (a string key), not to the time itself: it re-renders when the
 * playhead crosses a boundary, not every frame.
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisBlock, StrataDocument } from '@/types/strata'
import { formSpans, analysisLayers } from '@/lib/layers'
import { spanTypeName } from '@/lib/vocabulary'
import { EyeOff } from 'lucide-react'
import { READING_VIDEO_W } from '@/components/PlayerDock'
import {
  anchorRange,
  allBlocks,
  parseCommentary,
  passagesAt,
  spanBySlug,
  markerBySlug,
  stackAt,
  type StackRow,
} from './commentary'

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/**
 * The moment the stack shows: the playhead, or, paused with spans selected,
 * where the selection begins. Selecting a rotation then reads as the rotation
 * and what opens it (its first section and phrase); selecting a phrase, as the
 * phrase and everything it sits inside.
 */
function momentOf(doc: StrataDocument, time: number, selected: string[], playing: boolean): number {
  if (!playing && selected.length) {
    const spans = doc.layers.flatMap(formSpans).filter((s) => selected.includes(s.id))
    if (spans.length) return Math.min(...spans.map((s) => s.startTime))
  }
  return time
}

/** Commentary text: paragraphs, emphasis, and links that go to a span or marker. */
function CommentaryText({ doc, text }: { doc: StrataDocument; text: string }) {
  const selectSpan = useUIStore((s) => s.selectSpan)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const requestSeek = useUIStore((s) => s.requestSeek)
  const reading = useUIStore((s) => s.readingView)

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
    <>
      {parseCommentary(text).map((para, i) => (
        <p key={i} className={`max-w-[65ch] leading-relaxed text-foreground ${reading ? 'text-[17px]' : 'text-[14px]'}`}>
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
    </>
  )
}

/**
 * Commentary on a stretch of time. No span's Inspector owns it (and a deleted
 * span's commentary lands here), so it edits in place.
 */
function PassageBlock({ doc, block }: { doc: StrataDocument; block: AnalysisBlock }) {
  const [editing, setEditing] = useState(false)
  const reading = useUIStore((s) => s.readingView)
  const setCommentaryText = useDocumentStore((s) => s.setCommentaryText)
  const range = anchorRange(doc, block.anchor)
  return (
    <article className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">Passage</h2>
        {range && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {mmss(range[0])}–{mmss(range[1])}
          </span>
        )}
        <button
          className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </header>
      {editing && !reading ? (
        <textarea
          autoFocus
          className="w-full resize-y rounded border border-border bg-card px-2 py-1 text-[13px] leading-relaxed text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          rows={5}
          value={block.text}
          aria-label="Commentary on this passage"
          onChange={(e) => setCommentaryText(block.id, e.target.value)}
        />
      ) : (
        <CommentaryText doc={doc} text={block.text} />
      )}
    </article>
  )
}

/** One level of the stack: the layer, its span here, and what's written about it. */
function Level({
  doc,
  row,
  depth,
  selected,
  showLyrics,
}: {
  doc: StrataDocument
  row: StackRow
  depth: number
  selected: boolean
  showLyrics: boolean
}) {
  const { layer, span, block } = row
  const reading = useUIStore((s) => s.readingView)
  const heading = span.label || spanTypeName(span.type, doc.vocabulary.spanTypes) || 'Untitled span'
  return (
    <article
      className={`flex flex-col gap-1.5 border-l-2 py-1 pl-3 ${selected ? 'border-primary' : 'border-border'}`}
      style={{ marginLeft: depth * 14 }}
    >
      <header className="flex items-baseline gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{layer.label}</span>
        <h2 className={`font-semibold text-foreground ${reading ? 'text-xl' : 'text-sm'}`}>{heading}</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {mmss(span.startTime)}–{mmss(span.endTime)}
        </span>
      </header>
      {span.annotation && <p className="text-[13px] italic text-muted-foreground">{span.annotation}</p>}
      {block && <CommentaryText doc={doc} text={block.text} />}
      {showLyrics && span.lyrics && (
        <p className={`whitespace-pre-line leading-relaxed text-muted-foreground ${reading ? 'text-[15px] italic' : 'text-[13px]'}`}>{span.lyrics}</p>
      )}
    </article>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="max-w-md select-none text-center text-xs leading-relaxed text-muted-foreground">{children}</p>
}

/** What a new analysis needs next, in the order the work goes. */
function nextStep(doc: StrataDocument): string | null {
  const linked = !!doc.source.url || (doc.source.type === 'local' && !!doc.source.filename)
  if (!linked) return 'Start by linking a video or audio file in the play bar.'
  if (!doc.layers.some((l) => formSpans(l).length > 0))
    return 'Press Space to play, and B at each boundary you hear. M places a point marker.'
  if (!allBlocks(doc).length)
    return 'Click a span to describe it. Its commentary shows here while that passage plays.'
  return null
}

export function CommentaryPanel() {
  const doc = useDocumentStore((s) => s.document)
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  const showLyrics = useUIStore((s) => s.showLyrics)
  const setShowLyrics = useUIStore((s) => s.setShowLyrics)
  const selectedIds = useUIStore((s) => s.selectedSpanIds)
  const reading = useUIStore((s) => s.readingView)
  const showInReading = useUIStore((s) => s.readingShow.commentary)
  // A string key of what the stack holds now: equal strings mean no re-render.
  const momentKey = useUIStore((s) => {
    if (!doc) return ''
    const t = momentOf(doc, s.currentTime, s.selectedSpanIds, s.playbackState === 'playing')
    return [...passagesAt(doc, t).map((b) => b.id), ...stackAt(doc, t).map((r) => r.span.id)].join(',')
  })
  if (!doc) return null
  if (reading && !showInReading) return null

  // Before there's anything to read, this space coaches the next step of a
  // first analysis: link a source, mark boundaries, then describe a span.
  const hasSpans = doc.layers.some((l) => formSpans(l).length > 0)
  const step = nextStep(doc)
  if (!hasSpans) return reading ? null : <Hint>{step}</Hint>

  // Hidden commentary shows nothing here; the diagram's "Hidden:" chips bring
  // it back, as for a hidden layer.
  const commentaryLayers = analysisLayers(doc)
  if (commentaryLayers.length && !commentaryLayers.some((l) => l.visibility)) return null

  // Read the moment now rather than subscribing to it (see momentKey).
  void momentKey
  const ui = useUIStore.getState()
  const t = momentOf(doc, ui.currentTime, ui.selectedSpanIds, ui.playbackState === 'playing')
  const passages = passagesAt(doc, t)
  const rows = stackAt(doc, t)
  const anyLyrics = doc.layers.some((l) => formSpans(l).some((s) => s.lyrics))

  // Reading: the video sits top left (PlayerDock, READING_VIDEO_W), so the
  // commentary starts to its right, larger; the header's Show chips replace
  // these controls, and no editing hints show.
  const hasVideo = doc.source.type === 'youtube' && !!doc.source.url
  const readingStyle = reading && hasVideo ? { marginLeft: `calc(${READING_VIDEO_W} + 40px)` } : undefined
  const controls = reading ? null : (
    <div className="absolute right-3 top-2 flex items-center gap-1">
      {anyLyrics && (
        <button
          className={`rounded px-1.5 py-0.5 text-xs hover:bg-accent ${showLyrics ? 'text-foreground' : 'text-muted-foreground'}`}
          aria-pressed={showLyrics}
          onClick={() => setShowLyrics(!showLyrics)}
          title="Show each span's lyrics in the stack"
        >
          Lyrics {showLyrics ? 'on' : 'off'}
        </button>
      )}
      {commentaryLayers.length > 0 && (
        <button
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => commentaryLayers.forEach((l) => updateLayer(l.id, { visibility: false }))}
          title="Hide the commentary; show it again from the diagram's Hidden list"
        >
          <EyeOff size={12} aria-hidden /> Hide commentary
        </button>
      )}
    </div>
  )

  if (!rows.length && !passages.length)
    return (
      <>
        {controls}
        {!reading && <Hint>Nothing is marked at this moment.</Hint>}
      </>
    )
  return (
    <>
      {controls}
      <div
        className={`flex w-full flex-col gap-3 self-start px-4 py-4 ${reading ? 'max-w-176 gap-4' : 'max-w-2xl'}`}
        style={readingStyle}
        aria-live="polite"
      >
        {passages.map((b) => (
          <PassageBlock key={b.id} doc={doc} block={b} />
        ))}
        {rows.map((row, i) => (
          <Level
            key={row.span.id}
            doc={doc}
            row={row}
            depth={i}
            selected={selectedIds.includes(row.span.id)}
            showLyrics={showLyrics}
          />
        ))}
        {step && !reading && <p className="mt-1 text-xs text-muted-foreground">{step}</p>}
      </div>
    </>
  )
}
