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
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import type { AnalysisBlock, StrataDocument } from '@/types/strata'
import { formSpans, analysisLayers } from '@/lib/layers'
import { spanTypeName } from '@/lib/vocabulary'
import { EyeOff } from 'lucide-react'
import { READING_VIDEO_W } from '@/components/PlayerDock'
import { CommentaryMarkdown } from './CommentaryMarkdown'
import { CommentaryEditor } from './CommentaryEditor'
import {
  anchorRange,
  allBlocks,
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

/**
 * The moment the stack holds at while commentary is being edited, if what's
 * being edited is still in the document (another file may have been opened).
 */
function heldMoment(doc: StrataDocument, edit: { key: string; at: number } | null): number | null {
  if (!edit) return null
  const [kind, id] = edit.key.split(':')
  const exists = kind === 'span' ? doc.layers.some((l) => formSpans(l).some((s) => s.id === id)) : allBlocks(doc).some((b) => b.block.id === id)
  return exists ? edit.at : null
}

/** Commentary text, as Markdown, with [[slug]] links that go to a span or marker. */
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
    <div className="flex flex-col gap-2">
      <CommentaryMarkdown
        text={text}
        large={reading}
        exists={(slug) => !!spanBySlug(doc, slug) || !!markerBySlug(doc, slug)}
        onFollow={follow}
      />
    </div>
  )
}

/**
 * Commentary on a stretch of time. No span's Inspector owns it (and a deleted
 * span's commentary lands here), so it edits only here.
 */
function PassageBlock({ doc, block, moment }: { doc: StrataDocument; block: AnalysisBlock; moment: number }) {
  const reading = useUIStore((s) => s.readingView)
  const key = `block:${block.id}`
  const editing = useUIStore((s) => s.commentaryEdit?.key === key) && !reading
  const setCommentaryEdit = useUIStore((s) => s.setCommentaryEdit)
  const setCommentaryText = useDocumentStore((s) => s.setCommentaryText)
  const range = anchorRange(doc, block.anchor)
  return (
    <article className="group flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">Passage</h2>
        {range && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {mmss(range[0])}–{mmss(range[1])}
          </span>
        )}
        {!reading && !editing && <EditButton onPress={() => setCommentaryEdit({ key, at: moment })}>Edit</EditButton>}
      </header>
      {editing ? (
        <CommentaryEditor
          doc={doc}
          value={block.text}
          label="Commentary on this passage"
          onChange={(text) => setCommentaryText(block.id, text)}
          onDone={() => setCommentaryEdit(null)}
        />
      ) : (
        <div onDoubleClick={reading ? undefined : () => setCommentaryEdit({ key, at: moment })}>
          <CommentaryText doc={doc} text={block.text} />
        </div>
      )}
    </article>
  )
}

/** Edit / Add commentary: quiet until the block is hovered or has the keyboard. */
function EditButton({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="ml-auto text-xs text-muted-foreground opacity-0 underline-offset-2 transition-opacity hover:text-foreground hover:underline focus-visible:opacity-100 group-hover:opacity-100"
    >
      {children}
    </button>
  )
}

/** One level of the stack: the layer, its span here, and what's written about it. */
function Level({
  doc,
  row,
  depth,
  selected,
  showLyrics,
  moment,
}: {
  doc: StrataDocument
  row: StackRow
  depth: number
  selected: boolean
  showLyrics: boolean
  /** The stack's moment, held while this span's commentary is being edited. */
  moment: number
}) {
  const { layer, span, block } = row
  const reading = useUIStore((s) => s.readingView)
  const key = `span:${span.id}`
  const editing = useUIStore((s) => s.commentaryEdit?.key === key) && !reading
  const setCommentaryEdit = useUIStore((s) => s.setCommentaryEdit)
  const setSpanCommentary = useDocumentStore((s) => s.setSpanCommentary)
  const edit = () => setCommentaryEdit({ key, at: moment })
  // Nothing for an unlabelled, untyped span: the layer name and times say enough.
  const heading = span.label || spanTypeName(span.type, doc.vocabulary.spanTypes)
  return (
    <article
      className={`group flex flex-col gap-1.5 border-l-2 py-1 pl-3 ${selected ? 'border-primary' : 'border-border'}`}
      style={{ marginLeft: depth * 14 }}
    >
      <header className="flex items-baseline gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{layer.label}</span>
        {heading && <h2 className={`font-semibold text-foreground ${reading ? 'text-xl' : 'text-sm'}`}>{heading}</h2>}
        <span className="text-xs tabular-nums text-muted-foreground">
          {mmss(span.startTime)}–{mmss(span.endTime)}
        </span>
        {!reading && !editing && <EditButton onPress={edit}>{block ? 'Edit' : 'Add commentary'}</EditButton>}
      </header>
      {span.annotation && <p className="text-[13px] italic text-muted-foreground">{span.annotation}</p>}
      {editing ? (
        <CommentaryEditor
          doc={doc}
          value={block?.text ?? ''}
          label={`Commentary on ${heading || layer.label}`}
          onChange={(text) => setSpanCommentary(span.id, text)}
          onDone={() => setCommentaryEdit(null)}
        />
      ) : (
        block && (
          <div onDoubleClick={reading ? undefined : edit}>
            <CommentaryText doc={doc} text={block.text} />
          </div>
        )
      )}
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
    return doc.beatGrid?.length
      ? 'Click a span to describe it, or to make it a bar longer or shorter. Its commentary shows here while that passage plays.'
      : 'Click a span to describe it. Its commentary shows here while that passage plays.'
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
    const t = heldMoment(doc, s.commentaryEdit) ?? momentOf(doc, s.currentTime, s.selectedSpanIds, s.playbackState === 'playing')
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
  // While commentary is being edited, the stack holds at the moment editing began.
  const t = heldMoment(doc, ui.commentaryEdit) ?? momentOf(doc, ui.currentTime, ui.selectedSpanIds, ui.playbackState === 'playing')
  const passages = passagesAt(doc, t)
  const rows = stackAt(doc, t)
  const anyLyrics = doc.layers.some((l) => formSpans(l).some((s) => s.lyrics))

  // Reading: the video sits top left (PlayerDock, READING_VIDEO_W), so the
  // commentary starts to its right, larger; the header's Show chips replace
  // these controls, and no editing hints show.
  const hasVideo = doc.source.type === 'youtube' && !!doc.source.url
  const readingStyle = reading && hasVideo ? { marginLeft: `calc(${READING_VIDEO_W} + 40px)` } : undefined
  // At the top of the stack, not the corner: the corner mini player sits
  // there, and nothing may be drawn over it.
  const controls = reading || (!anyLyrics && !commentaryLayers.length) ? null : (
    <div className="-ml-1.5 flex items-center gap-1">
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
      <div className="flex flex-col items-center gap-2">
        {controls}
        {!reading && <Hint>Nothing is marked at this moment.</Hint>}
      </div>
    )
  return (
    <div
      className={`flex w-full flex-col gap-3 self-start px-4 py-4 ${reading ? 'max-w-176 gap-4' : 'max-w-2xl'}`}
      style={readingStyle}
      aria-live="polite"
    >
      {controls}
      {passages.map((b) => (
        <PassageBlock key={b.id} doc={doc} block={b} moment={t} />
      ))}
      {rows.map((row, i) => (
        <Level
          key={row.span.id}
          doc={doc}
          row={row}
          depth={i}
          selected={selectedIds.includes(row.span.id)}
          showLyrics={showLyrics}
          moment={t}
        />
      ))}
      {step && !reading && <p className="mt-1 text-xs text-muted-foreground">{step}</p>}
    </div>
  )
}
