/**
 * Source linking — set, swap, or unlink the document's playback source.
 *
 * SourceLinkForm is the reusable core. It renders in two hosts:
 * - LinkSourceDialog: the standalone quick-swap dialog, opened from the
 *   transport bar (open state lives in the UI store so any surface can open it).
 * - DocumentSettingsDialog: embedded as the "Source" section, so the
 *   new-analysis setup modal asks for metadata and media in one place.
 *
 * YouTube linking is paste-to-detect: the analyst pastes any YouTube URL shape
 * (watch, shorts, youtu.be, music.youtube, protocol-less) or a bare 11-char
 * video ID; the input validates live and the stored URL is normalized to the
 * canonical watch URL. Local audio linking picks a File — the document stores
 * only the filename (browsers can't reopen paths), the File itself goes to the
 * UI store for this session's playback.
 *
 * Offset rule: the sourceOffset belongs to a specific source. Relinking the
 * SAME media (same video ID / same filename) keeps the offset; linking
 * different media resets it to 0.
 */

import { useEffect, useState } from 'react'
import { Check, CircleAlert, Link2 } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { parseYouTubeInput, canonicalYouTubeUrl, extractVideoId } from '@/lib/youtube'
import { pickAudioFile } from '@/lib/fileIO'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { SourceType } from '@/types/strata'

// ---------------------------------------------------------------------------
// Field primitives (local copies — same precedent as DocumentSettingsDialog)
// ---------------------------------------------------------------------------

const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground ' +
  'focus:outline-hidden focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex shrink-0 rounded border border-border p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="whitespace-nowrap rounded px-2 py-0.5 text-xs transition-colors"
            style={{
              backgroundColor: active ? 'hsl(var(--primary))' : 'transparent',
              color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SourceLinkForm — the reusable linking core
// ---------------------------------------------------------------------------

const MODE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'local', label: 'Audio file' },
]

/**
 * Props:
 * - onDone: present when hosted in a dialog — link/unlink/cancel call it to
 *   close. Absent when embedded (settings): actions apply live, form stays.
 * - autoFocus: focus the URL input on mount (dialog host wants it; embedding
 *   in settings must not steal focus from the title field).
 */
export function SourceLinkForm({
  onDone,
  autoFocus = false,
}: {
  onDone?: () => void
  autoFocus?: boolean
}) {
  const doc = useDocumentStore((s) => s.document)
  const updateMeta = useDocumentStore((s) => s.updateMeta)
  const setAudioFile = useUIStore((s) => s.setAudioFile)

  const [mode, setMode] = useState<SourceType>('youtube')
  const [urlText, setUrlText] = useState('')
  const [pickedFile, setPickedFile] = useState<File | null>(null)

  const source = doc?.source ?? null
  const currentVideoId =
    source?.type === 'youtube' && source.url ? extractVideoId(source.url) : null
  const isLinked = currentVideoId != null || (source?.type === 'local' && !!source.filename)

  // Re-seed local state from the document on mount and whenever the linked
  // source actually changes (including after this form's own link action —
  // the fields then reflect the new "currently linked" state).
  // Noticed during render, not in an effect (react-hooks/set-state-in-effect).
  const sourceKey = source ? `${source.type}:${source.url ?? source.filename ?? ''}` : ''
  const [sourceSeen, setSourceSeen] = useState('')
  if (sourceSeen !== sourceKey) {
    setSourceSeen(sourceKey)
    if (doc) {
      setMode(isLinked ? doc.source.type : 'youtube')
      setUrlText(currentVideoId ? (doc.source.url ?? '') : '')
      setPickedFile(null)
    }
  }

  const parsedId = parseYouTubeInput(urlText)

  // Embedded in settings (no onDone) there is no Link button to forget: a
  // recognised video links as soon as it's pasted. A pasted link used to be
  // lost when the dialog closed without a click.
  const embedded = !onDone
  useEffect(() => {
    if (!embedded || !doc || !parsedId || parsedId === currentVideoId) return
    updateMeta({ source: { type: 'youtube', url: canonicalYouTubeUrl(parsedId), sourceOffset: 0 } })
    setAudioFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, parsedId])

  if (!doc) return null
  const showParseError = urlText.trim() !== '' && !parsedId

  function linkYouTube() {
    if (!doc || !parsedId) return
    // Same video (e.g. pasting a differently-shaped URL for it) keeps the
    // offset — it's a property of the media, not of the URL string.
    const sameVideo = parsedId === currentVideoId
    updateMeta({
      source: {
        type: 'youtube',
        url: canonicalYouTubeUrl(parsedId),
        sourceOffset: sameVideo ? doc.source.sourceOffset : 0,
      },
    })
    setAudioFile(null)
    onDone?.()
  }

  function linkAudio(file: File | null = pickedFile) {
    if (!doc || !file) return
    const sameFile = doc.source.type === 'local' && doc.source.filename === file.name
    updateMeta({
      source: {
        type: 'local',
        filename: file.name,
        sourceOffset: sameFile ? doc.source.sourceOffset : 0,
      },
    })
    setAudioFile(file)
    onDone?.()
  }

  function unlink() {
    // Mirrors createEmptyDocument's no-source shape: a youtube source with an
    // empty URL. Offset is per-source, so it resets with the source.
    updateMeta({ source: { type: 'youtube', url: '', sourceOffset: 0 } })
    setAudioFile(null)
    onDone?.()
  }

  const canLink = mode === 'youtube' ? parsedId != null : pickedFile != null

  // One row: the YouTube/audio switch beside its input. Below it, a status
  // line only when there's something to say.
  const status =
    mode === 'youtube' ? (
      parsedId ? (
        <>
          <Check size={11} className="shrink-0 text-primary" aria-hidden />
          <span>
            Video found: <code>{parsedId}</code>
            {parsedId === currentVideoId && ' (currently linked)'}
          </span>
        </>
      ) : showParseError ? (
        <>
          <CircleAlert size={11} className="shrink-0 text-destructive" aria-hidden />
          <span>Not a YouTube link or video ID.</span>
        </>
      ) : null
    ) : (
      <span>The file stays on your computer; you’ll pick it again next time.</span>
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
        {mode === 'youtube' ? (
          <input
            aria-label="YouTube URL or video ID"
            className={'min-w-0 ' + inputClass}
            placeholder="Paste a YouTube URL or video ID…"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && parsedId && linkYouTube()}
            autoFocus={autoFocus}
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={async () => {
                const file = await pickAudioFile()
                setPickedFile(file)
                // Choosing the file is the commit when embedded, as pasting is.
                if (embedded && file) linkAudio(file)
              }}
            >
              Choose file…
            </Button>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {pickedFile?.name ??
                (source?.type === 'local' && source.filename
                  ? `Currently: ${source.filename}`
                  : 'No file chosen')}
            </span>
          </div>
        )}
      </div>

      {(status || (embedded && isLinked)) && (
        <div className="flex items-start gap-1 text-[11px] text-muted-foreground" aria-live="polite">
          {status}
          {/* Embedded, unlinking is a quiet link at the end of the status line
              rather than a row of its own. */}
          {embedded && isLinked && (
            <button
              type="button"
              onClick={unlink}
              className="ml-auto shrink-0 text-destructive underline-offset-2 hover:underline"
            >
              Unlink
            </button>
          )}
        </div>
      )}

      {!embedded && (
      <div className="flex items-center justify-end gap-2">
        {isLinked && (
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto h-7 text-xs text-destructive hover:text-destructive"
            onClick={unlink}
          >
            Unlink source
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!canLink}
          onClick={mode === 'youtube' ? linkYouTube : () => linkAudio()}
        >
          {mode === 'youtube' ? 'Link video' : 'Link audio'}
        </Button>
      </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LinkSourceDialog — standalone quick-swap host (transport bar entry point)
// ---------------------------------------------------------------------------

export function LinkSourceDialog() {
  const doc = useDocumentStore((s) => s.document)
  const open = useUIStore((s) => s.linkSourceOpen)
  const setOpen = useUIStore((s) => s.setLinkSourceOpen)

  if (!doc) return null

  const currentVideoId =
    doc.source.type === 'youtube' && doc.source.url ? extractVideoId(doc.source.url) : null
  const isLinked = currentVideoId != null || (doc.source.type === 'local' && !!doc.source.filename)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Link2 size={14} strokeWidth={1.75} aria-hidden />
            {isLinked ? 'Change source' : 'Link a source'}
          </DialogTitle>
          <DialogDescription>
            The video or audio this analysis plays against. You can swap it any time; the analysis stays as it is.
          </DialogDescription>
        </DialogHeader>
        <SourceLinkForm autoFocus onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
