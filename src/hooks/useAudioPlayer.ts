import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import type { PlaybackRate } from '@/store/uiStore'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages an HTML5 audio playback engine for local audio file sources.
 * The second of the two engines behind PlayerDock (the other is
 * useYouTubePlayer); both expose the same command surface — play, pause,
 * seek, setRate — so the transport bar is source-agnostic.
 *
 * The audio element is created off-DOM (`new Audio()`); audio-only playback
 * needs no visual mount point. The picked File is turned into an object URL,
 * which is revoked whenever the file changes or the hook unmounts.
 *
 * Source offset: player_time = recording_time + sourceOffset (schema rule) —
 * same boundary convention as useYouTubePlayer. Everything crossing this
 * hook's API is RECORDING time.
 */
export function useAudioPlayer(file: File | null, sourceOffset: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const rafRef = useRef<number>(0)
  const aliveRef = useRef(true)
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
  // rAF loop — same precision as the YouTube engine (timeupdate is too coarse
  // for boundary-placement feedback)
  // ---------------------------------------------------------------------------

  function startLoop() {
    function tick() {
      if (!aliveRef.current) return
      const audio = audioRef.current
      if (audio) {
        setCurrentTime(Math.max(0, audio.currentTime - offsetRef.current))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function reportDuration(audio: HTMLAudioElement) {
    const dur = audio.duration
    setDuration(isFinite(dur) && dur > 0 ? Math.max(0, dur - offsetRef.current) : 0)
  }

  // ---------------------------------------------------------------------------
  // Element lifecycle — keyed on the picked file
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function teardown() {
      cancelAnimationFrame(rafRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    if (!file) {
      if (audioRef.current) {
        teardown()
        setCurrentTime(0)
        setDuration(0)
        setPlaybackState('unstarted')
        storeSetRate(1)
        // Leave a 'loading' status alone — it means the other engine is
        // already spinning up after a source-type switch.
        if (useUIStore.getState().playerStatus !== 'loading') {
          setPlayerStatus('uninitialized')
        }
      }
      return
    }

    // New file (first load or swap) — build a fresh element. Swapping via a
    // new element rather than resetting src keeps the event wiring trivial.
    teardown()
    setPlayerStatus('loading')
    setCurrentTime(0)
    setDuration(0)
    storeSetRate(1)

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audioRef.current = audio

    audio.addEventListener('loadedmetadata', () => {
      if (!aliveRef.current || audioRef.current !== audio) return
      reportDuration(audio)
      setPlayerStatus('ready')
      startLoop()
    })
    audio.addEventListener('play', () => setPlaybackState('playing'))
    audio.addEventListener('pause', () => setPlaybackState('paused'))
    audio.addEventListener('ended', () => setPlaybackState('ended'))
    audio.addEventListener('waiting', () => setPlaybackState('buffering'))
    audio.addEventListener('error', () => {
      if (audioRef.current !== audio) return
      setPlayerStatus('error', `Could not play "${file.name}" — unsupported or corrupt audio file.`)
    })

    return teardown
    // Store actions are stable Zustand references; offset flows through offsetRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Offset edits re-scale the reported duration (rAF loop reads offsetRef itself).
  useEffect(() => {
    if (audioRef.current && file) reportDuration(audioRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceOffset])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Stable command functions for the transport bar (recording time in/out)
  // ---------------------------------------------------------------------------

  const play = useCallback(() => {
    void audioRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current
      if (audio) audio.currentTime = Math.max(0, time + offsetRef.current)
      setCurrentTime(Math.max(0, time))
    },
    [setCurrentTime],
  )

  const setRate = useCallback(
    (rate: PlaybackRate) => {
      const audio = audioRef.current
      if (audio) audio.playbackRate = rate
      storeSetRate(rate)
    },
    [storeSetRate],
  )

  return { play, pause, seek, setRate }
}
