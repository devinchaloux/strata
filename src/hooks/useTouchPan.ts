/**
 * Drag the diagram sideways with a finger. Phones have no wheel, and the
 * editor's drag is a box-select, so where a reader is on a touch screen (the
 * embed, and the reading view on a phone) a drag pans instead, and holds the
 * playhead-following for a moment.
 */
import { useRef } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { clampScrollOffset, scrollableWidth } from '@/lib/timeline'

// A hand pan holds the playhead-following for this long.
const PAN_HOLD_MS = 4000

/** Pointer handlers to spread on the element that holds the diagram. */
export function useTouchPan() {
  const pan = useRef<{ x: number; offset: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return
    pan.current = { x: e.clientX, offset: useUIStore.getState().scrollOffset, moved: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pan.current
    if (!p) return
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) < 8) return
    p.moved = true
    const ui = useUIStore.getState()
    const duration = useDocumentStore.getState().document?.duration ?? 0
    ui.setScrollOffset(clampScrollOffset(p.offset - dx, scrollableWidth(duration, ui.zoom), ui.viewportWidth))
    ui.holdFollow(PAN_HOLD_MS)
  }
  function onPointerEnd() {
    // A pan isn't a tap: the click that follows it mustn't select a span.
    swallowClick.current = pan.current?.moved ?? false
    pan.current = null
  }
  function onClickCapture(e: React.MouseEvent) {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.stopPropagation()
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClickCapture,
  }
}
