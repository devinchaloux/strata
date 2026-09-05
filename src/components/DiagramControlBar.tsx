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
import { SHAPE_HEIGHT } from '@/lib/formShape' // TEMPORARY — ShapeLab only

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

/**
 * TEMPORARY — the shape lab. Two live sliders for the bracket corner curve and
 * the elision reach, so the values get chosen against real spans at real zoom
 * rather than from a mockup. Nothing here touches the document: it is UI state,
 * so it never dirties the file or lands in an undo step.
 *
 * Delete this component, `uiStore.shapeLab`, and the `cornerRadius` /
 * `elisionExtend` overrides in `buildShapePath` once the values are picked and
 * hard-coded back into formShape.ts.
 */
function ShapeLab() {
  const shapeLab = useUIStore((s) => s.shapeLab)
  const setShapeLab = useUIStore((s) => s.setShapeLab)

  return (
    <div className="ml-auto flex items-center gap-3 pr-1 text-[10px] text-muted-foreground">
      <label className="flex items-center gap-1.5" title="Corner curve on rounded and elision caps">
        <span className="uppercase tracking-wide">Corner</span>
        {/* Ceiling is SHAPE_HEIGHT: buildShapePath clamps r to the body height,
            so anything above 28 is inert. At the top of the range the corner is a
            quarter-circle sweeping the full height — worth seeing, even though
            the Adjoin Rework retired domes, since the flat top survives it. */}
        <input
          type="range"
          min={0}
          max={SHAPE_HEIGHT}
          step={0.5}
          value={shapeLab.cornerRadius}
          onChange={(e) => setShapeLab({ cornerRadius: Number(e.target.value) })}
          className="h-1 w-24 cursor-pointer"
        />
        <span className="w-6 tabular-nums">{shapeLab.cornerRadius}</span>
      </label>
      <label
        className="flex items-center gap-1.5"
        title="A corner may consume at most this share of a span's width, so narrow spans keep a flat top. At 0.5 the two corners meet and the flat top disappears."
      >
        <span className="uppercase tracking-wide">Narrow</span>
        <input
          type="range"
          min={0.1}
          max={0.5}
          step={0.05}
          value={shapeLab.cornerRatio}
          onChange={(e) => setShapeLab({ cornerRatio: Number(e.target.value) })}
          className="h-1 w-24 cursor-pointer"
        />
        <span className="w-6 tabular-nums">{shapeLab.cornerRatio}</span>
      </label>
      <label className="flex items-center gap-1.5" title="How far an elision cap reaches past the boundary">
        <span className="uppercase tracking-wide">Elision</span>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={shapeLab.elisionExtend}
          onChange={(e) => setShapeLab({ elisionExtend: Number(e.target.value) })}
          className="h-1 w-24 cursor-pointer"
        />
        <span className="w-6 tabular-nums">{shapeLab.elisionExtend}</span>
      </label>
    </div>
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
      <ShapeLab />
    </div>
  )
}
