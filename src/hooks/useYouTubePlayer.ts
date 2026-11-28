import { useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { mapYTState, loadYTApi } from '@/lib/youtube'
import type { PlaybackRate } from '@/store/uiStore'
import { PlayheadClock } from '@/lib/listeningDelay'
import { heardTime } from '@/hooks/playheadClock'

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
 * - With `away` (Help is open), videoId goes null too, but the time, duration
 *   and rate are kept, and the next player is built at that time and rate,
 *   paused, so the analyst comes back where they were.
 * - Runs a requestAnimationFrame loop to poll currentTime into the UI store.
 * - Returns stable command functions (play, pause, seek, setRate).
 *
 * Source offset: player_time = recording_time + sourceOffset (schema rule).
 * All times crossing this hook's boundary are RECORDING time — the offset is
 * applied on the way into the player (seek) and removed on the way out
 * (currentTime poll, duration). Span data and the UI store never see player time.
 *
 * Listening delay: the playhead and now() give the time being HEARD
 * (lib/listeningDelay.ts PlayheadClock): this browser's headphone delay comes
 * off while it plays, and the playhead holds rather than stepping back when
 * playback starts. mediaNow() is the player's own time, for the click track,
 * which plays through the same headphones and so is delayed with the media.
 *
 * Keyboard shortcuts are NOT handled here — they live in PlayerDock, where
 * they can drive whichever engine is active.
 */
export function useYouTubePlayer(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoId: string | null,
  sourceOffset: number,
  away = false,
) {
  const playerRef = useRef<YT.Player | null>(null)
  // Where to put the next player, in recording time: set when the player goes
  // away for Help, read once the new one is ready.
  const resumeRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  // Set by a seek made while not playing. YouTube starts a video that hasn't
  // been played yet (unstarted or cued) when it is seeked, so a click on a
  // span would begin playback; the state handler pauses it again instead.
  const holdPausedRef = useRef(false)
  // Signals the rAF loop to stop on unmount
  const aliveRef = useRef(true)
  // Latest offset, readable from the rAF loop and commands without re-subscribing
  const offsetRef = useRef(sourceOffset)
  // Written once the render commits, not while it runs (react-hooks/refs).
  useLayoutEffect(() => { offsetRef.current = sourceOffset })
  const clockRef = useRef(new PlayheadClock())

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
          if (isFinite(t)) setCurrentTime(heardTime(clockRef.current, Math.max(0, t - offsetRef.current)))
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
    if (!videoId && away) {
      // Off the page for Help: keep the time, duration and rate.
      if (playerRef.current) {
        cancelAnimationFrame(rafRef.current)
        let t = useUIStore.getState().currentTime
        try {
          const p = playerRef.current.getCurrentTime()
          if (isFinite(p)) t = Math.max(0, p - offsetRef.current)
        } catch {
          // Not ready: the last frame's time will do.
        }
        resumeRef.current = t
        playerRef.current.destroy()
        playerRef.current = null
        setPlaybackState('paused')
      }
      return
    }
    if (!videoId) {
      resumeRef.current = null
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
            const resume = resumeRef.current
            resumeRef.current = null
            if (resume != null) {
              const rate = useUIStore.getState().playbackRate
              if (rate !== 1) e.target.setPlaybackRate(rate)
              if (resume > 0) {
                holdPausedRef.current = true
                e.target.seekTo(resume + offsetRef.current, true)
                e.target.pauseVideo()
                setCurrentTime(resume)
              }
            }
            reportDuration(e.target)
            setPlayerStatus('ready')
            startLoop()
          },
          onStateChange: (e) => {
            // A seek while stopped asked to stay stopped (see `seek`).
            if (e.data === 1 && holdPausedRef.current) {
              holdPausedRef.current = false
              e.target.pauseVideo()
              return
            }
            setPlaybackState(mapYTState(e.data))
            // Refresh duration after cuing — it may have been 0 before metadata loaded
            if (e.data === 5) {
              reportDuration(e.target)
            }
          },
          onError: () => {
            setPlayerStatus('error')
          },
          // YouTube rounds a speed it doesn't offer to one it does: show that one.
          onPlaybackRateChange: (e) => {
            if (isFinite(e.data) && e.data > 0) storeSetRate(e.data)
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
    holdPausedRef.current = false
    playerRef.current?.playVideo()
  }, [])

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo()
  }, [])

  const seek = useCallback(
    (time: number) => {
      const player = playerRef.current
      const state = player?.getPlayerState?.()
      const playing = state === 1 || state === 3
      if (player && !playing) holdPausedRef.current = true
      player?.seekTo(Math.max(0, time + offsetRef.current), true)
      if (player && !playing) player.pauseVideo()
      clockRef.current.seek(time)
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

  // The exact recording time now, read from the player at the moment of a key
  // press. The store's currentTime is the last frame's reading (up to ~16 ms
  // old), which is too coarse for marking or tapping by ear.
  // The player's own time, before the listening delay (for the click track).
  const mediaNow = useCallback((): number => {
    try {
      const t = playerRef.current?.getCurrentTime()
      if (typeof t === 'number' && isFinite(t)) return Math.max(0, t - offsetRef.current)
    } catch {
      // Not ready: fall back to the last frame's time.
    }
    return useUIStore.getState().currentTime
  }, [])

  // The exact time being heard now: what a mark or a tap is for.
  const now = useCallback((): number => heardTime(clockRef.current, mediaNow(), false), [mediaNow])

  return { play, pause, seek, setRate, now, mediaNow }
}
