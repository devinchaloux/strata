import { useRef, useEffect } from 'react'
import { Link2, CircleAlert } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { extractVideoId, formatTime, isInputFocused } from '@/lib/youtube'
import { pickAudioFile } from '@/lib/fileIO'
import { SeekBar } from './SeekBar'
import type { PlaybackRate } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Icons (inline SVG — no dependency on lucide-react)
// ---------------------------------------------------------------------------

function RewindIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="2" height="12" rx="0.5" />
      <path d="M12.5 2.5L6 8l6.5 5.5V2.5z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 3L13 8 4.5 13V3z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="3.5" height="12" rx="0.75" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="0.75" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="25 11"
      />
    </svg>
  )
}

function VideoOnIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="9" height="8" rx="1" />
      <path d="M10 6.5L15 4v8l-5-2.5V6.5z" />
    </svg>
  )
}

function VideoOffIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="9" height="8" rx="1" />
      <path d="M10 6.5L15 4v8l-5-2.5V6.5z" />
      <line x1="2" y1="2" x2="14" y2="14" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Transport button
// ---------------------------------------------------------------------------

function TransportButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="p-1.5 rounded text-foreground
        hover:bg-accent hover:text-accent-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card
        disabled:opacity-40 disabled:pointer-events-none
        transition-colors"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// PlayerDock — source-agnostic transport bar + media panel
// ---------------------------------------------------------------------------

const RATES: PlaybackRate[] = [0.5, 0.75, 1, 1.25]

/**
 * The bottom dock: transport bar plus the collapsible video panel. Source-
 * agnostic — it reads doc.source, activates the matching playback engine
 * (YouTube IFrame or HTML5 audio), and exposes one command surface to the
 * transport controls and keyboard shortcuts.
 *
 * Also owns two pieces of source-linking behavior:
 * - The link affordance: "Link video or audio…" when the document has no
 *   playable source; a swap icon once linked; "Locate…" when a local-source
 *   document needs its audio file re-picked this session.
 * - Duration adoption: when a document with duration 0 (fresh analysis) gets
 *   a source whose metadata reports a duration, that duration is adopted into
 *   the document — the timeline is dead without it. Swaps on a document with
 *   a real duration never touch it (span timestamps are recording-time truth).
 */
export function PlayerDock() {
  const doc = useDocumentStore((s) => s.document)
  const loadId = useDocumentStore((s) => s.loadId)
  const updateMeta = useDocumentStore((s) => s.updateMeta)
  const addPointMarker = useDocumentStore((s) => s.addPointMarker)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)

  const {
    currentTime,
    duration,
    playbackState,
    playbackRate,
    playerStatus,
    playerError,
    videoPanelVisible,
    toggleVideoPanel,
    audioFile,
    setAudioFile,
    setLinkSourceOpen,
    linkSourceOpen,
    documentSettingsOpen,
    unsavedGuardOpen,
    recoveryModalOpen,
  } = useUIStore()

  // A linked YouTube iframe renders in its own GPU compositing layer that
  // ignores a Dialog overlay's dimming — it visibly punches through instead
  // of sitting behind the modal like the rest of the app. Since the iframe
  // can't be unmounted without killing the YT.Player, cover it with an opaque
  // curtain (in the same local stacking context, so it isn't subject to the
  // same cross-context quirk) whenever a modal that can be open at the same
  // time is up.
  const anyModalOpen =
    linkSourceOpen || documentSettingsOpen || unsavedGuardOpen || recoveryModalOpen

  const source = doc?.source ?? null
  const sourceOffset = source?.sourceOffset ?? 0

  const videoId =
    source?.type === 'youtube' && source.url ? extractVideoId(source.url) : null
  const isLocal = source?.type === 'local' && !!source.filename
  // Linked = the document names a playable source (even if the local file
  // still needs locating this session).
  const isLinked = videoId != null || isLocal

  // A loaded document's audio File never survives into another document —
  // clear the runtime handle whenever a different document loads.
  useEffect(() => {
    setAudioFile(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId])

  // Both engines are always mounted (hooks can't be conditional); exactly one
  // receives a non-null input, the other stays inert.
  const containerRef = useRef<HTMLDivElement>(null)
  const ytEngine = useYouTubePlayer(containerRef, videoId, sourceOffset)
  const audioEngine = useAudioPlayer(isLocal ? audioFile : null, sourceOffset)
  const engine = source?.type === 'local' ? audioEngine : ytEngine
  const engineRef = useRef(engine)
  engineRef.current = engine

  const isReady = playerStatus === 'ready'
  const isPlaying = playbackState === 'playing'
  const isBuffering = playbackState === 'buffering'
  const isLoading = playerStatus === 'loading'

  const { play, pause, seek, setRate } = engine

  function handlePlayPause() {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

  // Place a point marker at the current playhead — document-level, so unlike
  // Spacebar (which needs an active layer) this needs no layer context.
  function placeMarkerAtPlayhead() {
    const id = crypto.randomUUID()
    addPointMarker({ id, timestamp: useUIStore.getState().currentTime })
    selectPointMarker(id)
  }

  // ── Duration adoption ──────────────────────────────────────────────────────
  // Runs outside undo history (temporal pause): adopting the media's duration
  // is a system act on a fresh document, not an analyst edit to walk back.
  useEffect(() => {
    const d = useDocumentStore.getState().document
    if (!d || d.duration !== 0 || duration <= 0) return
    const temporal = useDocumentStore.temporal.getState()
    temporal.pause()
    updateMeta({ duration })
    temporal.resume()
  }, [duration, updateMeta])

  // ── Keyboard shortcuts (engine-agnostic) ──────────────────────────────────
  // K play/pause · J back 10s · L forward 10s · Home rewind. Modifier check
  // matters: Ctrl+J is merge — without the guard both actions would fire.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isInputFocused()) return
      const ui = useUIStore.getState()
      if (ui.playerStatus !== 'ready') return
      const cmds = engineRef.current

      switch (e.key) {
        case 'k':
        case 'K':
          e.preventDefault()
          if (ui.playbackState === 'playing') cmds.pause()
          else cmds.play()
          break
        case 'Home':
          e.preventDefault()
          cmds.seek(0)
          break
        case 'j':
        case 'J':
          e.preventDefault()
          cmds.seek(Math.max(0, ui.currentTime - 10))
          break
        case 'l':
        case 'L':
          e.preventDefault()
          cmds.seek(Math.min(ui.duration, ui.currentTime + 10))
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Spacebar (Phase 0.4 §8): while playing, place a boundary at the playhead on
  // the active layer; while paused, start playback. Live state is read via
  // getState() so the listener stays bound once. Text fields keep native space;
  // for buttons we preventDefault so a focused transport button isn't re-fired.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) {
        return
      }
      e.preventDefault()
      const ui = useUIStore.getState()
      if (ui.playbackState === 'playing') {
        if (ui.activeLayerId) {
          useDocumentStore.getState().placeBoundary(ui.activeLayerId, ui.currentTime)
        }
      } else {
        engineRef.current.play()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // M — place a point marker at the current playhead (document-level, so no
  // active-layer requirement, unlike Spacebar). Works during playback or paused.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'm' && e.key !== 'M') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isInputFocused()) return
      if (useUIStore.getState().playerStatus !== 'ready') return
      e.preventDefault()
      placeMarkerAtPlayhead()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Locate" flow: a local-source document was opened but the browser can't
  // reopen the file by name — the analyst re-picks it.
  async function handleLocate() {
    const file = await pickAudioFile()
    if (!file || !doc) return
    setAudioFile(file)
    // The analyst explicitly chose this file; if its name differs from the
    // stored reference, the stored reference follows it.
    if (doc.source.filename !== file.name) {
      updateMeta({ source: { ...doc.source, filename: file.name } })
    }
  }

  return (
    <>
      {/* ── Transport bar — always visible; sits above the video panel at the
          bottom of the shell (Phase 0.7 §2 — transport above video). ── */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-t border-border bg-card px-3">
        {/* Rewind */}
        <TransportButton
          onClick={() => seek(0)}
          disabled={!isReady}
          title="Rewind to start (Home)"
        >
          <RewindIcon />
        </TransportButton>

        {/* Play / Pause — spinner covers both mid-playback buffering and the
            initial source-loading window, so a loading source doesn't just
            look like an inert disabled button. */}
        <TransportButton
          onClick={handlePlayPause}
          disabled={!isReady}
          title={isLoading ? 'Loading…' : isPlaying ? 'Pause (K)' : 'Play (K)'}
        >
          {isBuffering || isLoading ? (
            <SpinnerIcon />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </TransportButton>

        {/* Seek bar */}
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          sharedTimePoints={doc?.sharedTimePoints ?? []}
          disabled={!isReady}
          onSeek={seek}
        />

        {/* Time display — tabular figures keep digit columns stable without mono */}
        <span className="shrink-0 text-xs tabular-nums text-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Playback rate selector */}
        <select
          value={String(playbackRate)}
          onChange={(e) => setRate(Number(e.target.value) as PlaybackRate)}
          disabled={!isReady}
          title="Playback rate"
          aria-label="Playback rate"
          className="h-7 rounded border border-border bg-card text-xs text-foreground px-1
            hover:bg-accent disabled:opacity-40 cursor-pointer transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          {RATES.map((r) => (
            <option key={r} value={String(r)}>
              {r}×
            </option>
          ))}
        </select>

        {/* The point-marker button and the Spacebar context indicator both used
            to sit here. They moved into the form diagram's control bar
            (2026-07-24): markers now render inside the diagram, so the controls
            that create them belong there too rather than in the player chrome.
            The M shortcut still works globally — this handler stays, only its
            button moved. Phase 0.4 §8's requirement that the current meaning of
            Space always be visible is still met, by the Boundary button's live
            Space chip. */}

        {/* Playback error — bad video ID, unsupported audio file, etc. */}
        {playerStatus === 'error' && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
            title={playerError ?? undefined}
          >
            <CircleAlert size={12} strokeWidth={1.75} aria-hidden />
            Playback error
          </span>
        )}

        {/* ── Source linking affordances ── */}
        {doc && !isLinked && (
          <button
            onClick={() => setLinkSourceOpen(true)}
            className="ml-auto shrink-0 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground
              transition-colors hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
          >
            Link video or audio…
          </button>
        )}

        {doc && isLocal && !audioFile && (
          <button
            onClick={handleLocate}
            title={`This analysis references "${source?.filename}" — pick the file to enable playback`}
            className="ml-auto max-w-[16rem] shrink-0 truncate rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground
              transition-colors hover:bg-accent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
          >
            Locate {source?.filename}…
          </button>
        )}

        {doc && isLinked && (
          <TransportButton
            onClick={() => setLinkSourceOpen(true)}
            title="Change source…"
          >
            <Link2 size={15} strokeWidth={1.75} />
          </TransportButton>
        )}

        {/* Video panel toggle — only shown when a video is loaded */}
        {videoId && (
          <TransportButton
            onClick={toggleVideoPanel}
            title={videoPanelVisible ? 'Hide video' : 'Show video'}
          >
            {videoPanelVisible ? <VideoOffIcon /> : <VideoOnIcon />}
          </TransportButton>
        )}
      </div>

      {/* ── Video panel ── */}
      {/* Only rendered when a YouTube URL is set. Height transitions 200↔0;
          the iframe stays in the DOM (CSS clip) so the IFrame API stays alive.
          position: relative hosts the modal-open curtain below. */}
      {videoId && (
        <div
          className="relative overflow-hidden border-t border-border transition-[height] duration-200 ease-in-out"
          style={{ height: videoPanelVisible ? 200 : 0 }}
        >
          {/* Inner target for YT.Player — always 200px so the player has dimensions */}
          <div ref={containerRef} className="w-full" style={{ height: 200 }} />

          {/* Curtain — see the anyModalOpen comment above. Opaque, blocks
              interaction, sits in this div's own stacking context so it isn't
              affected by the same iframe-compositing quirk it's working around. */}
          {anyModalOpen && (
            <div className="absolute inset-0 bg-card" aria-hidden />
          )}
        </div>
      )}
    </>
  )
}
