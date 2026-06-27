import { useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useDocumentStore } from '@/store/documentStore'
import {
  computePps,
  clampScrollOffset,
  totalContentWidth,
  computeFitZoom,
  clampZoom,
  minZoom,
  ABS_MAX_ZOOM,
} from '@/lib/timeline'

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
  const loadId = useDocumentStore((s) => s.loadId)

  const pps = computePps(zoom)
  const totalWidth = totalContentWidth(duration, zoom)
  const minZoomValue = minZoom(duration, viewportWidth)

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
  // Auto-fit on document load — open a track showing the whole thing, once.
  //
  // 100% is now a fixed scale (BASE_PPS), so the store's default zoom would open
  // a long track partway in. We instead fit-to-window the first time a document's
  // duration and the viewport are both known. Keyed on the store's loadId so EVERY
  // document load re-fits — including reloading the same document, or loading a
  // different one of identical duration (keying on duration alone missed both).
  // A window resize does NOT re-fit (loadId is unchanged → the analyst's zoom is kept).
  // ---------------------------------------------------------------------------
  // fitMode: while true, the timeline tracks the viewport width (fit-to-window).
  // It is set on load and when the user picks Fit, and cleared the moment they
  // zoom explicitly. This is what lets "Fit" stay fitted when the layer panel is
  // collapsed/expanded (which changes the ruler width) — Devin's side note.
  const fitModeRef = useRef(true)
  const fittedForLoadId = useRef<number | null>(null)
  useEffect(() => {
    if (duration <= 0 || viewportWidth <= 0) return
    if (fittedForLoadId.current === loadId) return
    fittedForLoadId.current = loadId
    fitModeRef.current = true
    setZoom(clampZoom(computeFitZoom(duration, viewportWidth), duration, viewportWidth))
    setScrollOffset(0)
  }, [loadId, duration, viewportWidth, setZoom, setScrollOffset])

  // Re-fit when the viewport width changes WHILE in fit mode (e.g. the layer
  // panel collapses, widening the ruler). When the analyst has zoomed away from
  // fit, width changes leave their zoom untouched.
  useEffect(() => {
    if (!fitModeRef.current) return
    if (duration <= 0 || viewportWidth <= 0) return
    setZoom(clampZoom(computeFitZoom(duration, viewportWidth), duration, viewportWidth))
    setScrollOffset(0)
  }, [viewportWidth, duration, setZoom, setScrollOffset])

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
        fitModeRef.current = false // explicit zoom leaves fit mode
        const rect = el!.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const timeUnderCursor = pps > 0 ? (scrollOffset + cursorX) / pps : 0

        const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
        const newZoom = clampZoom(zoom * factor, duration, viewportWidth)
        const newPps = computePps(newZoom)
        const newTotalWidth = totalContentWidth(duration, newZoom)
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
  // Zoom to a target zoom level, keeping the given anchor time fixed under the
  // given viewport x. Defaults to the viewport midpoint (used by the buttons).
  // ---------------------------------------------------------------------------
  const zoomTo = useCallback(
    (targetZoom: number, anchorX?: number) => {
      fitModeRef.current = false // an explicit zoom level leaves fit mode
      const { scrollOffset, pps, viewportWidth, duration } = snap.current
      const ax = anchorX ?? viewportWidth / 2
      const anchorTime = pps > 0 ? (scrollOffset + ax) / pps : 0
      const newZoom = clampZoom(targetZoom, duration, viewportWidth)
      const newPps = computePps(newZoom)
      const newTotalWidth = totalContentWidth(duration, newZoom)
      const newOffset = clampScrollOffset(anchorTime * newPps - ax, newTotalWidth, viewportWidth)
      setZoom(newZoom)
      setScrollOffset(newOffset)
    },
    [setZoom, setScrollOffset],
  )

  const zoomIn = useCallback(() => zoomTo(snap.current.zoom * 1.5), [zoomTo])
  const zoomOut = useCallback(() => zoomTo(snap.current.zoom / 1.5), [zoomTo])

  // Fit-to-window: show the whole track. resetTo100: snap to the standard 100%
  // scale, keeping the viewport-centered time in view.
  const fitToWindow = useCallback(() => {
    fitModeRef.current = true // re-enter fit mode; width changes will track
    const { duration, viewportWidth } = snap.current
    setZoom(clampZoom(computeFitZoom(duration, viewportWidth), duration, viewportWidth))
    setScrollOffset(0)
  }, [setZoom, setScrollOffset])
  const resetTo100 = useCallback(() => zoomTo(1), [zoomTo])

  return {
    containerRef,
    zoomIn,
    zoomOut,
    fitToWindow,
    resetTo100,
    setScrollOffset,
    minZoomValue,
    maxZoomValue: ABS_MAX_ZOOM,
    pps,
    totalWidth,
    zoom,
    scrollOffset,
    viewportWidth,
    currentTime,
    duration,
  }
}
