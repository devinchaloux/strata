/**
 * DiagramControlBar — the form diagram's placement actions, Boundary and
 * Marker, each labelled with its keyboard shortcut. They sit in the widget's
 * top bar, beside Add layer (they used to take a strip of their own along the
 * bottom).
 *
 * Merge is not here: it has Ctrl+J, the right-click menu and the Inspector's
 * "Merge N spans" button, which appears exactly when a merge is possible
 * (docs/decisions.md, "Tighter Diagram Chrome").
 *
 * Spacebar's label is live rather than static. Space places a boundary while
 * playing and starts playback while paused (Phase 0.4 §8), so a fixed "Space:
 * boundary" chip would be wrong half the time. The chip appears on Boundary
 * only while playback is running, which is exactly when Space does that job.
 */

import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { snapToActiveGrid } from '@/store/snap'

function BarButton({
  label,
  shortcut,
  title,
  disabled,
  onClick,
}: {
  label: string
  shortcut?: string
  title: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
    >
      <span>{label}</span>
      {shortcut && (
        <kbd className="rounded border border-border px-1 font-sans text-[9px] leading-[1.4] text-muted-foreground">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

export function DiagramControlBar() {
  const doc = useDocumentStore((s) => s.document)
  const placeBoundary = useDocumentStore((s) => s.placeBoundary)
  const addPointMarker = useDocumentStore((s) => s.addPointMarker)
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  // A yes/no subscription, not the time: the bar re-renders when the playhead
  // leaves zero, not on every playback frame. Clicks read the live time.
  const playheadMoved = useUIStore((s) => s.currentTime > 0)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const playbackState = useUIStore((s) => s.playbackState)

  if (!doc) return null

  const isPlaying = playbackState === 'playing'
  const canPlaceBoundary = activeLayerId !== null && playheadMoved
  const boundaryTitle = !activeLayerId
    ? 'Pick an active layer to place a boundary in'
    : !playheadMoved
      ? 'Move the playhead to place a boundary'
      : isPlaying
        ? 'Place a boundary in the active layer at the playhead (Space)'
        : 'Place a boundary in the active layer at the playhead. Space starts playback while paused.'

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <BarButton
        label="Boundary"
        shortcut={isPlaying ? 'Space' : undefined}
        title={boundaryTitle}
        disabled={!canPlaceBoundary}
        onClick={() => activeLayerId && placeBoundary(activeLayerId, snapToActiveGrid(useUIStore.getState().currentTime))}
      />
      <BarButton
        label="Marker"
        shortcut="M"
        title="Place a point marker at the playhead"
        onClick={() => {
          const id = crypto.randomUUID()
          addPointMarker({ id, timestamp: snapToActiveGrid(useUIStore.getState().currentTime) })
          selectPointMarker(id)
        }}
      />
    </div>
  )
}
