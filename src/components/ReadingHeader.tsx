/**
 * ReadingHeader — the top bar of the reading view: the piece, what to show,
 * and the way back to editing.
 *
 * The Show chips change only what this view draws (uiStore.readingShow); the
 * file's own layer visibility is untouched, so reading never edits the
 * analysis. docs/decisions.md, "The Reading View".
 */
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { analysisLayers, formSpans } from '@/lib/layers'

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-7 rounded-full border px-3 text-xs ${
        on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-accent'
      }`}
    >
      {label}
    </button>
  )
}

export function ReadingHeader() {
  const doc = useDocumentStore((s) => s.document)
  const show = useUIStore((s) => s.readingShow)
  const setShow = useUIStore((s) => s.setReadingShow)
  const showLyrics = useUIStore((s) => s.showLyrics)
  const setShowLyrics = useUIStore((s) => s.setShowLyrics)
  const setReadingView = useUIStore((s) => s.setReadingView)
  const setShareOpen = useUIStore((s) => s.setShareOpen)
  const sharedFrom = useUIStore((s) => s.sharedFrom)
  if (!doc) return null

  const hasCommentary = analysisLayers(doc).length > 0
  const hasLyrics = doc.layers.some((l) => formSpans(l).some((s) => s.lyrics))
  return (
    <>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-sm font-semibold text-foreground">{doc.title || 'Untitled analysis'}</h1>
        {doc.artist.length > 0 && <span className="truncate text-xs text-muted-foreground">{doc.artist.join(', ')}</span>}
      </div>
      <div className="ml-auto flex items-center gap-1.5" aria-label="Show">
        <span className="mr-1 text-xs text-muted-foreground">Show</span>
        {hasCommentary && <Chip on={show.commentary} label="Commentary" onClick={() => setShow('commentary', !show.commentary)} />}
        <Chip on={show.diagram} label="Form diagram" onClick={() => setShow('diagram', !show.diagram)} />
        {hasLyrics && <Chip on={showLyrics} label="Lyrics" onClick={() => setShowLyrics(!showLyrics)} />}
      </div>
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="ml-3 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
      >
        Share…
      </button>
      <button
        type="button"
        onClick={() => setReadingView(false)}
        title={sharedFrom ? 'Edit your own copy (save it to keep it)' : 'Back to editing (Esc)'}
        className="ml-2 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        {sharedFrom ? 'Edit a copy' : 'Edit'}
      </button>
    </>
  )
}
