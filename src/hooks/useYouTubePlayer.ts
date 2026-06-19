import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import { mapYTState, loadYTApi, isInputFocused } from '@/lib/youtube'
import type { PlaybackRate } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the YouTube IFrame API player lifecycle.
 *
 * - Creates the YT.Player when videoId first appears, targeting containerRef.
 * - Calls cueVideoById (no autoplay) when videoId changes on an existing player.
 * - Runs a requestAnimationFrame loop to poll currentTime into the UI store.
 * - Registers K / Home / J / L keyboard shortcuts at the document level.
 * - Returns stable command functions (play, pause, seek, setRate) for the transport bar.
 *
 * Space is NOT handled here — it belongs to the form diagram editor.
 */
export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoId: string | null,
) {
  const playerRef = useRef<YT.Player | null>(null)
  const rafRef = useRef<number>(0)
  // Signals the rAF loop to stop on unmount
  const aliveRef = useRef(true)

  const {
    setCurrentTime,
    setDuration,
    setPlaybackState,
    setPlayerStatus,
    setPlaybackRate: storeSetRate,
  } = useUIStore()

  // ---------------------------------------------------------------------------
  // rAF loop — always runs while player is ready (not just when playing)
  // ---------------------------------------------------------------------------

  function startLoop() {
    function tick() {
      if (!aliveRef.current) return
      if (playerRef.current) {
        try {
          const t = playerRef.current.getCurrentTime()
          if (isFinite(t)) setCurrentTime(t)
        } catch {
          // Player may not be fully ready on first tick; ignore
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // ---------------------------------------------------------------------------
  // Player lifecycle — keyed on videoId
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!videoId) {
      setPlayerStatus('uninitialized')
      return
    }

    if (!containerRef.current) return

    // Player already exists → cue the new video without autoplaying
    if (playerRef.current) {
      playerRef.current.cueVideoById(videoId)
      playerRef.current.setPlaybackRate(1)
      setCurrentTime(0)
      setDuration(0)
      storeSetRate(1)
      return
    }

    // First load — create the player
    let cancelled = false
    setPlayerStatus('loading')

    loadYTApi().then(() => {
      if (cancelled || !containerRef.current) return

      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          controls: 0,      // hide native controls — we supply our own
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,     // disable YT keyboard shortcuts; we handle our own
        },
        events: {
          onReady: (e) => {
            const dur = e.target.getDuration()
            setDuration(isFinite(dur) ? dur : 0)
            setPlayerStatus('ready')
            startLoop()
          },
          onStateChange: (e) => {
            setPlaybackState(mapYTState(e.data))
            // Refresh duration after cuing — it may have been 0 before metadata loaded
            if (e.data === 5) {
              const dur = e.target.getDuration()
              if (isFinite(dur) && dur > 0) setDuration(dur)
            }
          },
          onError: () => {
            setPlayerStatus('error')
          },
        },
      })
    })

    return () => {
      cancelled = true
    }
    // Intentionally omitting all deps except videoId:
    // - containerRef is a stable ref object
    // - store actions (setCurrentTime etc.) are stable Zustand references
    // - startLoop captures stable refs; re-running it on re-render would start multiple loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      cancelAnimationFrame(rafRef.current)
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return
      const player = playerRef.current
      if (!player) return

      switch (e.key) {
        case 'k':
        case 'K': {
          e.preventDefault()
          if (player.getPlayerState() === 1) {
            player.pauseVideo()
          } else {
            player.playVideo()
          }
          break
        }
        case 'Home': {
          e.preventDefault()
          player.seekTo(0, true)
          setCurrentTime(0)
          break
        }
        case 'j':
        case 'J': {
          e.preventDefault()
          const back = Math.max(0, player.getCurrentTime() - 10)
          player.seekTo(back, true)
          setCurrentTime(back)
          break
        }
        case 'l':
        case 'L': {
          e.preventDefault()
          const dur = player.getDuration()
          const fwd = Math.min(isFinite(dur) ? dur : 0, player.getCurrentTime() + 10)
          player.seekTo(fwd, true)
          setCurrentTime(fwd)
          break
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCurrentTime])

  // ---------------------------------------------------------------------------
  // Stable command functions for the transport bar
  // ---------------------------------------------------------------------------

  const play = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const seek = useCallback(
    (time: number) => {
      playerRef.current?.seekTo(time, true)
      setCurrentTime(time)
    },
    [setCurrentTime],
  )

  const setRate = useCallback(
    (rate: PlaybackRate) => {
      playerRef.current?.setPlaybackRate(rate)
      storeSetRate(rate)
    },
    [storeSetRate],
  )

  return { play, pause, seek, setRate }
}
