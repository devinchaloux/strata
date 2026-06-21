import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useDocumentStore } from '@/store/documentStore'
import { computePps, clampScrollOffset, MIN_ZOOM, MAX_ZOOM } from '@/lib/timeline'

export function useTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Store subscriptions
  const zoom = useUIStore((s) => s.zoom)
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)
  const currentTime = useUIStore((s) => s.currentTime)
  const playbackState = useUIStore((s) => s.playbackState)
  const setZoom = useUIStore((s) => s.setZoom)
  const setScrollOffset = useUIStore((s) => s.setScrollOffset)
  const setViewportWidth = useUIStore((s) => s.setViewportWidth)

  const duration = useDocumentStore((s) => s.document?.duration ?? 0)

  const pps = computePps(duration, viewportWidth, zoom)
  const totalWidth = viewportWidth * zoom

  // ---------------------------------------------------------------------------
  // Snapshot ref — gives non-React callbacks access to current reactive values
  // without making them stale-closure-prone deps.
  // ---------------------------------------------------------------------------
  const snap = useRef({ zoom, scrollOffset, pps, viewportWidth, duration, totalWidth })
  snap.current = { zoom, scrollOffset, pps, viewportWidth, duration, totalWidth }

  // ---------------------------------------------------------------------------
  // ResizeObserver — keep viewportWidth in sync with the container element
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Measure synchronously on mount — the ResizeObserver's first callback is
    // async and can be missed when this component mounts after the document
    // loads (the ruler only renders once a document exists).
    setViewportWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setViewportWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [setViewportWidth])

  // ---------------------------------------------------------------------------
  // DAW cursor following — only fires during active playback.
  //
  // Off-screen left: snap to 20% (handles backward seek while playing).
  // Approaching or past right edge: follow at 80% (standard DAW behavior).
  // No auto-scroll when paused — prevents YouTube hover-preview time updates
  // from snapping the ruler.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const { pps, viewportWidth, totalWidth, scrollOffset } = snap.current
    if (playbackState !== 'playing' || pps <= 0 || viewportWidth <= 0) return

    const cursorPx = currentTime * pps - scrollOffset

    if (cursorPx < 0) {
      // Off-screen left — reveal at 20%
      setScrollOffset(
        clampScrollOffset(currentTime * pps - viewportWidth * 0.2, totalWidth, viewportWidth),
      )
    } else if (cursorPx > viewportWidth * 0.8) {
      // Approaching or past right edge — follow at 80%
      setScrollOffset(
        clampScrollOffset(currentTime * pps - viewportWidth * 0.8, totalWidth, viewportWidth),
      )
    }
  }, [currentTime, playbackState, setScrollOffset])

  // ---------------------------------------------------------------------------
  // Wheel handler — non-passive so we can call preventDefault().
  // Plain wheel = pan; Ctrl/Meta + wheel = zoom centered on cursor.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { zoom, scrollOffset, pps, viewportWidth, duration, totalWidth } = snap.current

      if (e.ctrlKey || e.metaKey) {
        // Zoom: keep the time under the cursor fixed.
        const rect = el!.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const timeUnderCursor = pps > 0 ? (scrollOffset + cursorX) / pps : 0

        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
        const newPps = computePps(duration, viewportWidth, newZoom)
        const newTotalWidth = viewportWidth * newZoom
        const newOffset = clampScrollOffset(
          timeUnderCursor * newPps - cursorX,
          newTotalWidth,
          viewportWidth,
        )

        setZoom(newZoom)
        setScrollOffset(newOffset)
      } else {
        // Pan: prefer deltaX for trackpad horizontal swipe; fall back to deltaY.
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        setScrollOffset(clampScrollOffset(scrollOffset + delta, totalWidth, viewportWidth))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setZoom, setScrollOffset]) // stable store actions — no stale closure risk

  // ---------------------------------------------------------------------------
  // Zoom buttons — cursor-centered on the viewport midpoint
  // ---------------------------------------------------------------------------
  const applyZoom = useCallback(
    (factor: number) => {
      const { zoom, scrollOffset, pps, viewportWidth, duration } = snap.current
      const centerTime = pps > 0 ? (scrollOffset + viewportWidth / 2) / pps : 0
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
      const newPps = computePps(duration, viewportWidth, newZoom)
      const newTotalWidth = viewportWidth * newZoom
      const newOffset = clampScrollOffset(
        centerTime * newPps - viewportWidth / 2,
        newTotalWidth,
        viewportWidth,
      )
      setZoom(newZoom)
      setScrollOffset(newOffset)
    },
    [setZoom, setScrollOffset],
  )

  const zoomIn = useCallback(() => applyZoom(1.5), [applyZoom])
  const zoomOut = useCallback(() => applyZoom(1 / 1.5), [applyZoom])
  const resetZoom = useCallback(() => {
    setZoom(MIN_ZOOM)
    setScrollOffset(0)
  }, [setZoom, setScrollOffset])

  return {
    containerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    pps,
    totalWidth,
    zoom,
    scrollOffset,
    viewportWidth,
    currentTime,
    duration,
  }
}
