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
  'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

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
    <div className="flex rounded border border-border p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-1 rounded px-1.5 py-0.5 text-[11px] transition-colors"
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
  { value: 'youtube', label: 'YouTube video' },
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
  const sourceKey = source ? `${source.type}:${source.url ?? source.filename ?? ''}` : ''
  useEffect(() => {
    if (!doc) return
    setMode(isLinked ? doc.source.type : 'youtube')
    setUrlText(currentVideoId ? (doc.source.url ?? '') : '')
    setPickedFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey])

  if (!doc) return null

  const parsedId = parseYouTubeInput(urlText)
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

  function linkAudio() {
    if (!doc || !pickedFile) return
    const sameFile = doc.source.type === 'local' && doc.source.filename === pickedFile.name
    updateMeta({
      source: {
        type: 'local',
        filename: pickedFile.name,
        sourceOffset: sameFile ? doc.source.sourceOffset : 0,
      },
    })
    setAudioFile(pickedFile)
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

  return (
    <div className="flex flex-col gap-3">
      <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />

      {mode === 'youtube' ? (
        <div>
          <input
            className={inputClass}
            placeholder="Paste a YouTube URL or video ID…"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && parsedId && linkYouTube()}
            autoFocus={autoFocus}
          />
          <p
            className="mt-1 flex min-h-[1rem] items-center gap-1 text-[10px]"
            aria-live="polite"
          >
            {parsedId && (
              <>
                <Check size={11} className="text-primary" aria-hidden />
                <span className="text-muted-foreground">
                  Video detected — ID <code>{parsedId}</code>
                  {parsedId === currentVideoId && ' (currently linked)'}
                </span>
              </>
            )}
            {showParseError && (
              <>
                <CircleAlert size={11} className="text-destructive" aria-hidden />
                <span className="text-muted-foreground">
                  Not a recognized YouTube URL or video ID
                </span>
              </>
            )}
          </p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => setPickedFile(await pickAudioFile())}
            >
              Choose audio file…
            </Button>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {pickedFile?.name ??
                (source?.type === 'local' && source.filename
                  ? `Currently: ${source.filename}`
                  : 'No file chosen')}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            The file stays on your computer — the analysis stores only its name, so
            you'll be asked to locate it again next session.
          </p>
        </div>
      )}

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
        {onDone && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!canLink}
          onClick={mode === 'youtube' ? linkYouTube : linkAudio}
        >
          {mode === 'youtube' ? 'Link video' : 'Link audio'}
        </Button>
      </div>
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
            The video or audio file this analysis plays against. Span timestamps always
            store recording time, so swapping the source never touches your analysis data.
          </DialogDescription>
        </DialogHeader>
        <SourceLinkForm autoFocus onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
