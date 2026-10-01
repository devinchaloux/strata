import { useRef, useEffect, useState, useCallback } from 'react'
import { Link2, CircleAlert, PictureInPicture2, PanelBottom, ArrowDown, ArrowUp } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { extractVideoId, formatClock, isInputFocused } from '@/lib/youtube'
import { pickAudioFile } from '@/lib/fileIO'
import { setPlayerElement } from '@/lib/playerClearance'
import { snapToActiveGrid } from '@/store/snap'
import { fitTaps } from '@/lib/beatGrid'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { SeekBar } from './SeekBar'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
 * YouTube's embed rules require the player's viewport to be at least 200×200
 * and the player to stay present, so the video can move but never collapse or
 * hide. It may scroll out of view (as an embed in a blog post does); it may not
 * be shrunk below this or removed.
 */
const VIDEO_MIN = 200
/** Mini player width: 16:9 at the minimum height. */
const VIDEO_MINI_WIDTH = Math.round((VIDEO_MIN * 16) / 9)
/**
 * Docked below the fold it costs the work area nothing, so it gets the size
 * YouTube recommends for a 16:9 player (at least 480×270).
 */
const VIDEO_DOCKED_W = 480
const VIDEO_DOCKED_H = 270

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
    videoMini,
    toggleVideoMini,
    audioFile,
    setAudioFile,
    setLinkSourceOpen,
  } = useUIStore()

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

  // ── Video below the fold ──────────────────────────────────────────────────
  // Docked, the video sits under the work area, off-screen until scrolled to.
  // The Video button scrolls there and back; whether it's in view decides
  // which way it goes.
  const [videoEl, setVideoEl] = useState<HTMLDivElement | null>(null)
  const [videoInView, setVideoInView] = useState(false)
  useEffect(() => {
    if (!videoEl) return
    const io = new IntersectionObserver(([e]) => setVideoInView(e.intersectionRatio >= 0.5), {
      threshold: [0, 0.5, 1],
    })
    io.observe(videoEl)
    return () => io.disconnect()
  }, [videoEl])
  // Stable, so React calls it only when the element mounts or unmounts.
  const registerVideo = useCallback((el: HTMLDivElement | null) => {
    setPlayerElement(el)
    setVideoEl(el)
  }, [])
  function toggleVideoView() {
    if (videoInView) window.scrollTo({ top: 0, behavior: 'smooth' })
    else videoEl?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }
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
    addPointMarker({ id, timestamp: snapToActiveGrid(engineRef.current.now()) })
    selectPointMarker(id)
  }

  // Seek requests from outside the transport (commentary links).
  const seekRequest = useUIStore((s) => s.seekRequest)
  useEffect(() => {
    if (!seekRequest || useUIStore.getState().playerStatus !== 'ready') return
    engineRef.current.seek(seekRequest.time)
    if (seekRequest.play && useUIStore.getState().playbackState !== 'playing') engineRef.current.play()
  }, [seekRequest])

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
          useDocumentStore.getState().placeBoundary(ui.activeLayerId, snapToActiveGrid(engineRef.current.now()))
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

  // Beat grid by ear (lib/beatGrid.ts), all on one key. T is tap-along: tap on
  // each beat while it plays, starting on a downbeat; from the fourth tap the
  // grid runs from the first tap at the tapped tempo, and each further tap
  // refines it. A new run after a free passage picks the grid up again; a run
  // within an existing segment marks a tempo change from there. Shift+T stops
  // the grid at the playhead: free from here. Taps are read in media time, so
  // they stay right at slower playback, and one run is one undo step.
  useEffect(() => {
    let taps: number[] = []
    let lastTapWall = 0
    let tapGesture = ''
    let tapSegment: string | null = null
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 't' && e.key !== 'T') return
      if (e.metaKey || e.ctrlKey || e.altKey || isInputFocused()) return
      const ui = useUIStore.getState()
      const store = useDocumentStore.getState()
      if (!store.document || ui.playerStatus !== 'ready') return
      e.preventDefault()
      if (e.shiftKey) {
        store.endGridAt(engineRef.current.now())
        return
      }
      if (ui.playbackState !== 'playing') return
      const wall = performance.now()
      if (wall - lastTapWall > 2000) {
        taps = []
        tapGesture = newGestureKey('tap-along')
        tapSegment = null
      }
      lastTapWall = wall
      taps.push(engineRef.current.now())
      const fit = fitTaps(taps)
      if (fit) {
        withHistoryGroup(tapGesture, () => {
          tapSegment = store.layGridFromTaps(fit.start, fit.bpm, tapSegment)
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
          {formatClock(currentTime)} / {formatClock(duration)}
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
            title={`Find ${source?.filename} on this computer to play it.`}
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

        {/* Scroll to the docked video and back. It can't be hidden (YouTube's
            rules), so this is how it gets out of the way. */}
        {videoId && !videoMini && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleVideoView}
                className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium text-foreground
                  hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
              >
                {videoInView ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />}
                {videoInView ? 'Back to diagram' : 'Video'}
              </button>
            </TooltipTrigger>
            {!videoInView && (
              <TooltipContent className="max-w-60">
                YouTube requires its player to stay on the page, so it can’t be hidden. Scroll down to watch.
              </TooltipContent>
            )}
          </Tooltip>
        )}

        {/* Video placement — docked below, or a mini player in the corner.
            There is deliberately no "hide": see VIDEO_MIN below. */}
        {videoId && (
          <TransportButton
            onClick={toggleVideoMini}
            title={videoMini ? 'Dock the video below the play bar' : 'Shrink the video to a corner'}
          >
            {videoMini ? (
              <PanelBottom size={15} strokeWidth={1.75} />
            ) : (
              <PictureInPicture2 size={15} strokeWidth={1.75} />
            )}
          </TransportButton>
        )}
      </div>

      {/* ── Video panel ── */}
      {/* One element in both placements: switching only changes its CSS, so
          the iframe is never moved in the DOM (moving an iframe reloads it and
          kills the YT.Player). Docked, it sits in the column's flow below the
          play bar, which is the bottom of the first screen, so it starts out of
          view; as a mini player it floats in the left column's top-right
          corner, over the empty canvas above the bottom-anchored diagram.
          Either way it stays at least VIDEO_MIN × VIDEO_MIN. Nothing may cover it (YouTube's rules): z-[60]
          sits above every menu, popover and dialog (z-50), it registers itself
          so dialogs and their dimming keep clear (lib/playerClearance), and
          pointer-events stays on so it works while a dialog is open. */}
      {videoId && (
        <div
          className={
            videoMini
              ? 'absolute right-3 top-3 z-[60] overflow-hidden rounded-md border border-border shadow-lg'
              : 'relative z-[60] m-3 overflow-hidden rounded-md border border-border'
          }
          style={{
            ...(videoMini
              ? { width: VIDEO_MINI_WIDTH, height: VIDEO_MIN }
              : { width: `min(${VIDEO_DOCKED_W}px, calc(100% - 24px))`, minWidth: VIDEO_MIN, height: VIDEO_DOCKED_H }),
            pointerEvents: 'auto',
          }}
          ref={registerVideo}
        >
          <div ref={containerRef} className="h-full w-full" />
        </div>
      )}
    </>
  )
}
