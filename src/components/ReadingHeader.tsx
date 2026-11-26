/**
 * ReadingHeader — the top bar of the reading view: the piece, what to show,
 * and the way back to editing.
 *
 * View ▾ holds what this view draws, one checked row each (docs/decisions.md,
 * "Reading View Has a View Menu"). It changes only this view (uiStore
 * readingShow and the view preferences); the file's own layer visibility is
 * untouched, so reading never edits the analysis ("The Reading View"). The
 * menu stays open while rows are toggled, and grows with new options without
 * taking more of the bar.
 *
 * On a phone the bar is one row: the piece, View and Share. There is no Edit
 * there, since a phone reads and plays (decisions.md, "Read and Play on a
 * Phone").
 */
import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { analysisLayers, segmentSpans } from '@/lib/layers'

interface ViewRow {
  name: string
  hint: string
  on: boolean
  toggle: () => void
  separator?: boolean
}

/** A menu of checked rows that stays open; one hint line at the foot ("Menus Are Names"). */
function ViewMenu({ rows, rest }: { rows: ViewRow[]; rest: string }) {
  const [hint, setHint] = useState<string | null>(null)
  return (
    <Popover onOpenChange={(o) => !o && setHint(null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          View
          <ChevronDown size={12} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-60 p-1.5" onMouseLeave={() => setHint(null)}>
        <div className="flex flex-col" role="menu" aria-label="View">
          {rows.map((row) => (
            <div key={row.name}>
              {row.separator && <div className="my-1 border-t border-border" />}
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={row.on}
                onMouseEnter={() => setHint(row.hint)}
                onFocus={() => setHint(row.hint)}
                onClick={row.toggle}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden"
              >
                <span className="flex w-4 shrink-0 justify-center">{row.on && <Check size={14} aria-hidden />}</span>
                <span>{row.name}</span>
              </button>
            </div>
          ))}
          <p
            className="-mx-1.5 -mb-1.5 mt-1 min-h-[2rem] rounded-b-md border-t border-border bg-(--guide-faint) px-3 py-2 text-[12px] leading-snug text-muted-foreground"
            aria-live="polite"
          >
            {hint ?? rest}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ReadingHeader({ phone = false }: { phone?: boolean }) {
  const doc = useDocumentStore((s) => s.document)
  const show = useUIStore((s) => s.readingShow)
  const setShow = useUIStore((s) => s.setReadingShow)
  const showLyrics = useUIStore((s) => s.showLyrics)
  const setShowLyrics = useUIStore((s) => s.setShowLyrics)
  const colorblindSafe = useUIStore((s) => s.colorblindSafe)
  const gridShown = useUIStore((s) => s.gridShown)
  const setGridShown = useUIStore((s) => s.setGridShown)
  const setColorblindSafe = useUIStore((s) => s.setColorblindSafe)
  const setReadingView = useUIStore((s) => s.setReadingView)
  const setShareOpen = useUIStore((s) => s.setShareOpen)
  const sharedFrom = useUIStore((s) => s.sharedFrom)
  if (!doc) return null

  const hasCommentary = analysisLayers(doc).length > 0
  const hasLyrics = doc.layers.some((l) => segmentSpans(l).some((s) => s.lyrics))
  const rows: ViewRow[] = [
    ...(hasCommentary
      ? [{ name: 'Commentary', hint: 'The commentary, as it plays.', on: show.commentary, toggle: () => setShow('commentary', !show.commentary) }]
      : []),
    { name: 'Segments', hint: 'The diagram of spans.', on: show.diagram, toggle: () => setShow('diagram', !show.diagram) },
    ...(hasLyrics ? [{ name: 'Lyrics', hint: 'Lyrics in the spans.', on: showLyrics, toggle: () => setShowLyrics(!showLyrics) }] : []),
    ...((doc.beatGrid?.length ?? 0) > 0
      ? [{ name: 'Grid', hint: 'Bar lines and bar numbers. Hiding them keeps the grid.', on: gridShown, toggle: () => setGridShown(!gridShown) }]
      : []),
    {
      name: 'Color-blind safe',
      hint: 'Fills that color-blind readers can tell apart.',
      on: colorblindSafe,
      toggle: () => setColorblindSafe(!colorblindSafe),
      separator: true,
    },
  ]
  return (
    <>
      <div className={`flex min-w-0 items-baseline gap-2 ${phone ? 'flex-1' : ''}`}>
        <h1 className="truncate text-sm font-semibold text-foreground">{doc.title || 'Untitled analysis'}</h1>
        {doc.artist.length > 0 && <span className="truncate text-xs text-muted-foreground">{doc.artist.join(', ')}</span>}
      </div>
      <div className={phone ? '' : 'ml-auto'}>
        <ViewMenu rows={rows} rest="What this view shows. The file stays as it is." />
      </div>
      <button
        type="button"
        onClick={() => setShareOpen(true)}
        className="ml-2 rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
      >
        Share
      </button>
      {!phone && (
      <button
        type="button"
        onClick={() => setReadingView(false)}
        title={sharedFrom ? 'Edit your own copy (save it to keep it)' : 'Back to editing (Esc)'}
        className="ml-2 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        {sharedFrom ? 'Edit a copy' : 'Edit'}
      </button>
      )}
    </>
  )
}
