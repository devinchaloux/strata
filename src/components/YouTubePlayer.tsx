import { useRef, useEffect } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { extractVideoId, formatTime } from '@/lib/youtube'
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
// YouTubePlayer
// ---------------------------------------------------------------------------

const RATES: PlaybackRate[] = [0.5, 0.75, 1, 1.25]

export function YouTubePlayer() {
  const doc = useDocumentStore((s) => s.document)

  const {
    currentTime,
    duration,
    playbackState,
    playbackRate,
    playerStatus,
    videoPanelVisible,
    toggleVideoPanel,
  } = useUIStore()

  const youtubeUrl =
    doc?.source.type === 'youtube' ? (doc.source.url ?? null) : null
  const videoId = youtubeUrl ? extractVideoId(youtubeUrl) : null

  const containerRef = useRef<HTMLDivElement>(null)
  const { play, pause, seek, setRate } = useYouTubePlayer(containerRef, videoId)

  const isReady = playerStatus === 'ready'
  const isPlaying = playbackState === 'playing'
  const isBuffering = playbackState === 'buffering'

  function handlePlayPause() {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }

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
        play()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [play])

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

        {/* Play / Pause */}
        <TransportButton
          onClick={handlePlayPause}
          disabled={!isReady}
          title={isPlaying ? 'Pause (K)' : 'Play (K)'}
        >
          {isBuffering ? (
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
          the iframe stays in the DOM (CSS clip) so the IFrame API stays alive. */}
      {videoId && (
        <div
          className="overflow-hidden border-t border-border transition-[height] duration-200 ease-in-out"
          style={{ height: videoPanelVisible ? 200 : 0 }}
        >
          {/* Inner target for YT.Player — always 200px so the player has dimensions */}
          <div ref={containerRef} className="w-full" style={{ height: 200 }} />
        </div>
      )}
    </>
  )
}
