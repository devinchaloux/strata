import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import { mapYTState, loadYTApi } from '@/lib/youtube'
import type { PlaybackRate } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the YouTube IFrame API player lifecycle. One of the two playback
 * engines behind PlayerDock (the other is useAudioPlayer); both expose the
 * same command surface so the transport bar is source-agnostic.
 *
 * - Creates the YT.Player when videoId first appears, targeting containerRef.
 * - Calls cueVideoById (no autoplay) when videoId changes on an existing player.
 * - DESTROYS the player when videoId goes null (source unlinked) — the video
 *   panel unmounts with it, so a later re-link must build a fresh player on
 *   the freshly mounted container rather than cue into a dead iframe.
 * - Runs a requestAnimationFrame loop to poll currentTime into the UI store.
 * - Returns stable command functions (play, pause, seek, setRate).
 *
 * Source offset: player_time = recording_time + sourceOffset (schema rule).
 * All times crossing this hook's boundary are RECORDING time — the offset is
 * applied on the way into the player (seek) and removed on the way out
 * (currentTime poll, duration). Span data and the UI store never see player time.
 *
 * Keyboard shortcuts are NOT handled here — they live in PlayerDock, where
 * they can drive whichever engine is active.
 */
export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoId: string | null,
  sourceOffset: number,
) {
  const playerRef = useRef<YT.Player | null>(null)
  const rafRef = useRef<number>(0)
  // Signals the rAF loop to stop on unmount
  const aliveRef = useRef(true)
  // Latest offset, readable from the rAF loop and commands without re-subscribing
  const offsetRef = useRef(sourceOffset)
  offsetRef.current = sourceOffset

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
          if (isFinite(t)) setCurrentTime(Math.max(0, t - offsetRef.current))
        } catch {
          // Player may not be fully ready on first tick; ignore
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  /** Report the player's duration to the UI store, in recording time. */
  function reportDuration(player: YT.Player) {
    const dur = player.getDuration()
    if (isFinite(dur) && dur > 0) {
      setDuration(Math.max(0, dur - offsetRef.current))
    } else {
      setDuration(0)
    }
  }

  // ---------------------------------------------------------------------------
  // Player lifecycle — keyed on videoId
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Unlinked → tear the player down and reset playback state. The video
    // panel container unmounts alongside, so the instance can't be reused.
    if (!videoId) {
      if (playerRef.current) {
        cancelAnimationFrame(rafRef.current)
        playerRef.current.destroy()
        playerRef.current = null
        setCurrentTime(0)
        setDuration(0)
        setPlaybackState('unstarted')
        storeSetRate(1)
      }
      // Leave a 'loading' status alone — it means the other engine is already
      // spinning up after a source-type switch (video → audio).
      if (useUIStore.getState().playerStatus !== 'loading') {
        setPlayerStatus('uninitialized')
      }
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
            reportDuration(e.target)
            setPlayerStatus('ready')
            startLoop()
          },
          onStateChange: (e) => {
            setPlaybackState(mapYTState(e.data))
            // Refresh duration after cuing — it may have been 0 before metadata loaded
            if (e.data === 5) {
              reportDuration(e.target)
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

  // Offset edits in document settings re-scale the reported duration; the rAF
  // loop picks the new offset up on its own via offsetRef.
  useEffect(() => {
    if (playerRef.current && videoId) reportDuration(playerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOffset])

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
  // Stable command functions for the transport bar (recording time in/out)
  // ---------------------------------------------------------------------------

  const play = useCallback(() => {
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const seek = useCallback(
    (time: number) => {
      playerRef.current?.seekTo(Math.max(0, time + offsetRef.current), true)
      setCurrentTime(Math.max(0, time))
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
