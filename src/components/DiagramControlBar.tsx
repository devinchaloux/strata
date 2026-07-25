/**
 * DiagramControlBar — a thin strip along the bottom of the form diagram widget
 * carrying its structural operations, each labelled with its keyboard shortcut.
 *
 * It occupies the space the marker band gives up when a document has no
 * markers. Two jobs: make the shortcuts discoverable without a manual, and give
 * the operations a persistent surface. The Phase 0.5 merge decisions asked for
 * exactly that for merge — "a persistent toolbar button is always visible; its
 * disabled/enabled state communicates merge eligibility at a glance" — which
 * had never been built; Ctrl+J, the context menu, and the metadata panel were
 * the only routes.
 *
 * Spacebar's label is live rather than static. Space places a boundary while
 * playing and starts playback while paused (Phase 0.4 §8), so a fixed "Space:
 * boundary" chip would be wrong half the time. The chip appears on Boundary
 * only while playback is running, which is exactly when Space does that job.
 * This replaces the persistent indicator the transport bar used to carry —
 * the shortcut now lives next to the operation it performs rather than in the
 * player chrome.
 */

import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useMerge } from '@/hooks/useMerge'

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
  const currentTime = useUIStore((s) => s.currentTime)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const playbackState = useUIStore((s) => s.playbackState)
  const { eligibility, performMerge } = useMerge()

  if (!doc) return null

  const isPlaying = playbackState === 'playing'
  const canPlaceBoundary = activeLayerId !== null && currentTime > 0
  const boundaryTitle = !activeLayerId
    ? 'Pick an active layer to place a boundary in'
    : currentTime <= 0
      ? 'Move the playhead to place a boundary'
      : isPlaying
        ? 'Place a boundary in the active layer at the playhead (Space)'
        : 'Place a boundary in the active layer at the playhead. Space starts playback while paused.'

  return (
    <div
      className="flex shrink-0 items-center gap-1 border-t px-1.5 py-0.5"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <BarButton
        label="Boundary"
        shortcut={isPlaying ? 'Space' : undefined}
        title={boundaryTitle}
        disabled={!canPlaceBoundary}
        onClick={() => activeLayerId && placeBoundary(activeLayerId, currentTime)}
      />
      <BarButton
        label="Marker"
        shortcut="M"
        title="Place a point marker at the playhead"
        onClick={() => {
          const id = crypto.randomUUID()
          addPointMarker({ id, timestamp: currentTime })
          selectPointMarker(id)
        }}
      />
      <BarButton
        label="Merge"
        shortcut="Ctrl+J"
        title={eligibility.ok ? 'Merge the selected spans' : eligibility.reason}
        disabled={!eligibility.ok}
        onClick={() => performMerge()}
      />
    </div>
  )
}
