/**
 * TimelineScrollbar — a thin draggable horizontal scrollbar for the timeline.
 *
 * The timeline pans by writing `scrollOffset` (the SVG is translated by
 * −scrollOffset inside an overflow-hidden column); there is no native scroll to
 * borrow a scrollbar from. This is that scrollbar: it appears only when the
 * content is wider than the viewport (i.e. when zoomed in past fit) and stays in
 * sync with `scrollOffset`.
 *
 * Track width == the content column width == viewportWidth, so all geometry is
 * computed against viewportWidth (see scrollbarMetrics in lib/timeline).
 */

import { useRef } from 'react'
import { scrollbarMetrics, scrollOffsetFromThumbX } from '@/lib/timeline'

const SCROLLBAR_HEIGHT = 12 // px — track height (gutter)
const THUMB_HEIGHT = 6 // px

export function TimelineScrollbar({
  totalWidth,
  viewportWidth,
  scrollOffset,
  onScroll,
}: {
  totalWidth: number
  viewportWidth: number
  scrollOffset: number
  onScroll: (offset: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const { visible, thumbWidth, thumbX, maxThumbX, maxScroll } = scrollbarMetrics(
    totalWidth,
    viewportWidth,
    scrollOffset,
  )

  // Always reserve the gutter so the ruler doesn't jump when overflow toggles.
  if (!visible) {
    return <div style={{ height: SCROLLBAR_HEIGHT }} aria-hidden />
  }

  // Drag the thumb: track pointer deltas and convert to scrollOffset. Using a
  // delta (not absolute clientX) keeps the math origin-independent.
  function onThumbPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startThumbX = thumbX
    const move = (ev: PointerEvent) => {
      const nextThumbX = Math.max(0, Math.min(maxThumbX, startThumbX + (ev.clientX - startX)))
      onScroll(scrollOffsetFromThumbX(nextThumbX, maxThumbX, maxScroll))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Click the track (not the thumb): page toward the click by one viewport.
  function onTrackPointerDown(e: React.PointerEvent) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const clickX = e.clientX - rect.left
    const page = viewportWidth * 0.9
    const next = clickX < thumbX ? scrollOffset - page : scrollOffset + page
    onScroll(Math.max(0, Math.min(maxScroll, next)))
  }

  return (
    <div
      ref={trackRef}
      onPointerDown={onTrackPointerDown}
      className="relative select-none"
      style={{
        height: SCROLLBAR_HEIGHT,
        cursor: 'pointer',
      }}
    >
      <div
        onPointerDown={onThumbPointerDown}
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls="timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(maxScroll)}
        aria-valuenow={Math.round(scrollOffset)}
        tabIndex={0}
        style={{
          position: 'absolute',
          top: (SCROLLBAR_HEIGHT - THUMB_HEIGHT) / 2,
          left: thumbX,
          width: thumbWidth,
          height: THUMB_HEIGHT,
          borderRadius: THUMB_HEIGHT / 2,
          backgroundColor: 'hsl(var(--muted-foreground))',
          opacity: 0.4,
          cursor: 'grab',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.6')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
      />
    </div>
  )
}
