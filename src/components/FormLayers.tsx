/**
 * FormLayers — the stack of form-diagram layers rendered above the timeline ruler.
 *
 * Interactions:
 *   Click span          → single-select
 *   Shift+click span    → range-select within layer
 *   Ctrl/Cmd+click span → toggle span in/out of selection
 *   Click empty space   → deselect all
 *   Box-drag empty space → select all spans that overlap the rectangle (within the
 *                          layer row where the drag started)
 *   Right-click span    → context menu (Split / Merge / Delete)
 *   Drag boundary handle → move the shared edge between two adjacent spans
 */

import { memo, useCallback, useRef, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useMerge } from '@/hooks/useMerge'
import { computePps, totalContentWidth, snapTime } from '@/lib/timeline'
import { stackHeight, shapeTopY, layerBodyHeight, layerIndexAtY } from '@/lib/formShape'
import { layoutMarkerBand, BAND_TOP_GAP, BAND_ROW_HEIGHT, GLYPH_HALF, type MarkerPlacement } from '@/lib/markerBand'
import { MIN_SPAN_WIDTH, MIN_BOUNDARY_DRAG_PX } from '@/lib/spanEdit'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { gridLines, sortedSegments, barLength, beatLength } from '@/lib/beatGrid'
import { spanTypeName } from '@/lib/vocabulary'
import { QuickEntryBar } from './QuickEntryBar'
import { snapToActiveGrid } from '@/store/snap'
import { Playhead } from './Playhead'
import { FormDiagramFigure, type SpanDecoration } from '@/widgets/form-diagram/figure'
import { EDITOR_THEME } from '@/widgets/form-diagram/theme'
import type { Layer, Span, FormDiagramData, PointMarker, VocabTerm, GridSegment } from '@/types/strata'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'

// Stable empty references, so a null document doesn't produce a new array on
// every render (which would defeat the store's identity comparison).
const EMPTY_MARKERS: PointMarker[] = []
const EMPTY_TERMS: VocabTerm[] = []

/** Screen-pixel movement before a marker pointerdown counts as a drag. */
const MARKER_DRAG_THRESHOLD_PX = 3

// Selection styling (BriFormer convention): a light grey box fills the selected
// span's rectangle with a blue outline — the blue reads even when the span
// already has a grey/colored fill. Hover is a fainter grey wash, no outline.
const SELECT_BLUE = '#2563eb'
const SELECT_GREY = '#64748b'


// ---------------------------------------------------------------------------
// Context menu for a single span — used by SpanShape
// ---------------------------------------------------------------------------

// One menu per layer (see LayerInteraction); Radix mounts ContextMenuContent's
// children only while it's open, so the subscriptions below (selection, merge
// eligibility) cost nothing while it's closed. The playback time is read once, when
// the menu opens, rather than subscribed to per frame.
function SpanContextMenuContent({ span, layer }: { span: Span; layer: Layer }) {
  return (
    <ContextMenuContent>
      <SpanMenuItems span={span} layer={layer} />
    </ContextMenuContent>
  )
}

function SpanMenuItems({ span, layer }: { span: Span; layer: Layer }) {
  const selectedIds = useUIStore((s) => s.selectedSpanIds)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const [currentTime] = useState(() => useUIStore.getState().currentTime)
  const removeSpan = useDocumentStore((s) => s.removeSpan)
  const placeBoundary = useDocumentStore((s) => s.placeBoundary)
  const { eligibility, performMerge, neighborId } = useMerge()

  const isInSelection = selectedIds.includes(span.id)
  const isMulti = isInSelection && selectedIds.length > 1

  const prevId = neighborId(span.id, 'prev')
  const nextId = neighborId(span.id, 'next')
  const canSplit = currentTime > span.startTime && currentTime < span.endTime

  function handleDelete() {
    removeSpan(layer.id, span.id)
    selectSpan(null)
  }

  if (isMulti) {
    // Multi-span: show merge (when eligible) + Delete.
    // Merge entry is absent when ineligible (spec §3.3).
    return (
      <>
        {eligibility.ok && (
          <>
            <ContextMenuItem onClick={() => performMerge()}>
              Merge {selectedIds.length} spans
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          Delete
        </ContextMenuItem>
      </>
    )
  }

  // Single span: Split / Merge-with-neighbour / Delete.
  return (
    <ContextMenuContent>
      <ContextMenuItem
        disabled={!canSplit}
        onClick={canSplit ? () => placeBoundary(layer.id, currentTime) : undefined}
      >
        <span className="flex flex-col">
          Split at playhead
          {/* A greyed-out item should say why. */}
          {!canSplit && <span className="text-[11px]">Move the playhead into this span first.</span>}
        </span>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!prevId}
        onClick={prevId ? () => performMerge([prevId, span.id]) : undefined}
      >
        Merge with previous
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!nextId}
        onClick={nextId ? () => performMerge([span.id, nextId]) : undefined}
      >
        Merge with next
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={handleDelete}
        className="text-destructive focus:text-destructive"
      >
        Delete
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

// ---------------------------------------------------------------------------
// Selection highlight — drawn inside each span by the figure
// ---------------------------------------------------------------------------

// Selection styling (BriFormer convention): a light grey box over the span with
// a blue outline, so the blue reads even on a coloured fill. Hover is a fainter
// wash. The figure draws this between the shape and its text, so text stays
// crisp. Per-span subscriptions: a span re-renders only when its own state flips.
const SelectionHighlight: SpanDecoration = ({ span, width, height }) => {
  const isSelected = useUIStore((s) => s.selectedSpanIds.includes(span.id))
  const isHovered = useUIStore((s) => s.hoveredSpanId === span.id)
  if (!isSelected && !isHovered) return null
  return (
    <rect
      x={-1}
      y={-1}
      width={width + 2}
      height={height + 2}
      rx={3}
      fill={SELECT_GREY}
      fillOpacity={isSelected ? 0.2 : 0.08}
      stroke={isSelected ? SELECT_BLUE : 'none'}
      strokeWidth={isSelected ? 1.5 : 0}
    />
  )
}

// ---------------------------------------------------------------------------
// Interaction layer — invisible targets laid over the figure
// ---------------------------------------------------------------------------

/** Begins a boundary drag for the shared edge between two adjacent spans. */
type BoundaryDragStart = (
  layerId: string,
  leftSpanId: string,
  rightSpanId: string,
) => (e: React.PointerEvent) => void

/**
 * A span's click target: selection gestures, hover, the right-click menu and
 * the native tooltip. Covers the whole body, so open brackets are as easy to
 * click as filled ones.
 */
function SpanHitTarget({
  span,
  layer,
  pps,
  dragCommittedRef,
}: {
  span: Span
  layer: Layer
  pps: number
  /** True while a box-drag was just committed — suppresses the click that follows. */
  dragCommittedRef: React.RefObject<boolean>
}) {
  const selectSpan = useUIStore((s) => s.selectSpan)
  const toggleSpan = useUIStore((s) => s.toggleSpan)
  const setSelection = useUIStore((s) => s.setSelection)
  const hoverSpan = useUIStore((s) => s.hoverSpan)
  const spanTypes = useDocumentStore((s) => s.document?.vocabulary.spanTypes ?? EMPTY_TERMS)

  // Modifier-aware selection (Merge UX §1): plain click single-selects;
  // ctrl/cmd-click toggles; shift-click selects the range from the anchor.
  function handleClick(e: React.MouseEvent) {
    // A box-drag just finished; let the click bubble so the container resets.
    if (dragCommittedRef.current) return
    e.stopPropagation()
    if (e.shiftKey) {
      const anchorId = useUIStore.getState().selectionAnchorId
      const sorted = [...(layer.data as FormDiagramData).spans].sort((a, b) => a.startTime - b.startTime)
      const anchorIdx = sorted.findIndex((s) => s.id === anchorId)
      // No anchor, or the anchor is in another layer: treat as a plain click.
      if (anchorIdx === -1) {
        selectSpan(span.id)
        return
      }
      const clickedIdx = sorted.findIndex((s) => s.id === span.id)
      const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
      setSelection(sorted.slice(lo, hi + 1).map((s) => s.id), anchorId)
    } else if (e.metaKey || e.ctrlKey) {
      toggleSpan(span.id)
    } else {
      selectSpan(span.id)
      // Paused, a click also moves the playhead to the span, so pressing play
      // starts there. While playing it only selects: a click to edit shouldn't
      // pull the analyst out of what they're hearing.
      if (useUIStore.getState().playbackState !== 'playing') useUIStore.getState().requestSeek(span.startTime)
    }
  }

  const x = span.startTime * pps
  const width = (span.endTime - span.startTime) * pps
  if (width <= 0) return null
  const displayLabel = layer.spanShape === 'bar' ? span.keyArea || span.label : span.label
  const titleText = [displayLabel, spanTypeName(span.type, spanTypes)].filter(Boolean).join(' · ')

  return (
    <rect
      data-span-id={span.id}
      x={x}
      y={0}
      width={width}
      height={layerBodyHeight(layer)}
      fill="transparent"
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => hoverSpan(span.id)}
      onMouseLeave={() => hoverSpan(null)}
      onClick={handleClick}
      // Double-click plays from the span's start.
      onDoubleClick={() => useUIStore.getState().requestSeek(span.startTime, true)}
    >
      {titleText && <title>{titleText}</title>}
    </rect>
  )
}

/**
 * One layer's targets: a click target per span, then a drag handle at each
 * shared edge (after the targets, so the handle wins at the edge). Locked
 * layers get no handles. Memoized like the figure's layers.
 */
const LayerInteraction = memo(function LayerInteraction({
  layer,
  topY,
  pps,
  onBoundaryDragStart,
  dragCommittedRef,
}: {
  layer: Layer
  topY: number
  pps: number
  onBoundaryDragStart: BoundaryDragStart
  dragCommittedRef: React.RefObject<boolean>
}) {
  // One right-click menu for the whole layer, told which span was clicked when
  // it opens. A menu per span meant hundreds of menu components re-rendering on
  // every edit of a large analysis.
  const [menuSpanId, setMenuSpanId] = useState<string | null>(null)
  // Reading view: spans still select and seek, but nothing edits.
  const reading = useUIStore((s) => s.readingView)
  if (!layer.visibility) return null
  const spans = (layer.data as FormDiagramData).spans
  const bodyHeight = layerBodyHeight(layer)
  const menuSpan = menuSpanId ? spans.find((s) => s.id === menuSpanId) : undefined

  // Right-click on an unselected span selects it, so the menu reflects it; on a
  // selected span it keeps the selection, so multi-merge still works.
  function handleContextMenu(e: React.MouseEvent) {
    const id = (e.target as Element).closest('[data-span-id]')?.getAttribute('data-span-id') ?? null
    setMenuSpanId(id)
    if (id && !useUIStore.getState().selectedSpanIds.includes(id)) useUIStore.getState().selectSpan(id)
  }

  if (reading)
    return (
      <g transform={`translate(0, ${topY})`}>
        {spans.map((span) => (
          <SpanHitTarget key={span.id} span={span} layer={layer} pps={pps} dragCommittedRef={dragCommittedRef} />
        ))}
      </g>
    )

  return (
    <g transform={`translate(0, ${topY})`}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <g onContextMenu={handleContextMenu}>
            {spans.map((span) => (
              <SpanHitTarget key={span.id} span={span} layer={layer} pps={pps} dragCommittedRef={dragCommittedRef} />
            ))}
          </g>
        </ContextMenuTrigger>
        {menuSpan && <SpanContextMenuContent span={menuSpan} layer={layer} />}
      </ContextMenu>
      {!layer.locked &&
        spans.map((span, i) => {
          const next = spans[i + 1]
          if (!next || Math.abs(span.endTime - next.startTime) > 1e-6) return null
          return (
            <rect
              key={`bound-${span.id}`}
              x={span.endTime * pps - 3}
              y={-2}
              width={6}
              height={bodyHeight + 4}
              fill="transparent"
              style={{ cursor: 'ew-resize' }}
              onPointerDown={onBoundaryDragStart(layer.id, span.id, next.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )
        })}
    </g>
  )
})

/**
 * The beat grid behind the diagram: bar lines, and beat lines once they're far
 * enough apart to read. Zoomed out, bar lines thin to every 2nd, 4th… bar. Free
 * stretches between grid segments get no lines at all.
 */
const BeatGridLines = memo(function BeatGridLines({
  grid,
  duration,
  pps,
  height,
}: {
  grid: GridSegment[] | undefined
  duration: number
  pps: number
  height: number
}) {
  const segs = sortedSegments(grid)
  if (!segs.length || pps <= 0) return null
  const minBar = Math.min(...segs.map(barLength)) * pps
  const minBeat = Math.min(...segs.map(beatLength)) * pps
  const showBeats = minBeat >= 6
  let every = 1
  while (minBar * every < 8) every *= 2
  const lines = gridLines(segs, duration, 0, duration)
  return (
    <g aria-hidden pointerEvents="none">
      {lines.map((l) =>
        l.bar !== null ? (
          (l.bar - 1) % every === 0 && (
            <line key={l.time} x1={l.time * pps} x2={l.time * pps} y1={0} y2={height} stroke="var(--ruler)" strokeOpacity={0.45} />
          )
        ) : (
          showBeats && (
            <line key={l.time} x1={l.time * pps} x2={l.time * pps} y1={0} y2={height} stroke="var(--hairline)" strokeOpacity={0.6} />
          )
        ),
      )}
    </g>
  )
})

/** A marker's target: covers its glyph and caption, for select and drag. */
function MarkerHitTarget({
  placement,
  bandTop,
  onPointerDown,
}: {
  placement: MarkerPlacement
  bandTop: number
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const { marker, x, row, caption } = placement
  const left = Math.min(placement.left, x - GLYPH_HALF - 2)
  const right = Math.max(placement.right, x + GLYPH_HALF + 2)
  return (
    <rect
      x={left}
      y={bandTop + BAND_TOP_GAP}
      width={right - left}
      height={(row + 1) * BAND_ROW_HEIGHT}
      fill="transparent"
      style={{ cursor: 'ew-resize' }}
      onPointerDown={onPointerDown}
      onDoubleClick={() => useUIStore.getState().requestSeek(marker.timestamp, true)}
      // The container's click clears the selection, and a marker click bubbles
      // to it; stopping it here keeps the selection the pointerup just made.
      onClick={(e) => e.stopPropagation()}
      role="presentation"
    >
      <title>{marker.label || caption || `Marker at ${marker.timestamp.toFixed(2)}s`}</title>
    </rect>
  )
}

// ---------------------------------------------------------------------------
// FormLayers
// ---------------------------------------------------------------------------

/** Box-drag state — tracked while the user drags on empty canvas space. */
interface BoxDragState {
  /** Content-space x at drag start (matches SVG coordinates). */
  startX: number
  /** Content-space x at current pointer position. */
  endX: number
  /** Container-local y at drag start. */
  startY: number
  /** Index of the layer row where the drag began. */
  layerIdx: number
  /** True once the pointer has moved more than the commit threshold. */
  committed: boolean
}

// Minimum pointer movement (px) before a pointerdown is treated as a drag
// rather than a click. Keeps accidental micro-drags from overriding clicks.
const BOX_DRAG_THRESHOLD = 4

export function FormLayers({ layers }: { layers: Layer[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoom = useUIStore((s) => s.zoom)
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const setSelection = useUIStore((s) => s.setSelection)
  const reading = useUIStore((s) => s.readingView)
  const setAdjacentBoundary = useDocumentStore((s) => s.setAdjacentBoundary)
  const duration = useDocumentStore((s) => s.document?.duration ?? 0)

  // Marker band state. Selected via the whole document object rather than
  // `?? []` selectors, which would return a fresh array on every render.
  const doc = useDocumentStore((s) => s.document)
  const updatePointMarker = useDocumentStore((s) => s.updatePointMarker)
  const selectedMarkerId = useUIStore((s) => s.selectedPointMarkerId)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const pointMarkers = doc?.pointMarkers ?? EMPTY_MARKERS
  const markerTypes = doc?.vocabulary.pointMarkerTypes ?? EMPTY_TERMS
  const showCaptions = doc?.showCadenceCaptions ?? true

  const pps = computePps(zoom)
  const totalWidth = totalContentWidth(duration, zoom)
  const svgWidth = Math.max(totalWidth, viewportWidth)
  // Every layer keeps a slot (hidden ones render empty) so the header column and
  // the canvas stay row-aligned; FormLayerGroup draws nothing for hidden layers.
  const stackH = stackHeight(layers)

  // Marker band — document-level point markers live inside the diagram (so
  // they export with it), in a band below the layer stack.
  const bandLayout = layoutMarkerBand(pointMarkers, markerTypes, pps)
  const svgHeight = stackH + bandLayout.height


  // Box-drag selection state.
  const [boxDrag, setBoxDrag] = useState<BoxDragState | null>(null)
  // True when a drag was committed on this pointer sequence — used to suppress
  // the subsequent onClick from clearing the selection we just built.
  const dragCommittedRef = useRef(false)

  // Convert a screen x to a timeline content-space position (SVG x coordinate).
  function clientXToContent(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || pps <= 0) return 0
    return scrollOffset + (clientX - rect.left)
  }

  // Convert a screen x to a timeline time, accounting for the container's left
  // edge and the horizontal scroll. (A span at time t is painted at
  // containerLeft - scrollOffset + t*pps.)
  function clientXToTime(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || pps <= 0) return 0
    return (scrollOffset + (clientX - rect.left)) / pps
  }

  // Boundary drag: while the pointer moves, push the shared boundary to the
  // store (which clamps it). Captured pps/scrollOffset are stable for the drag.
  // Stable across renders (so memoized layer groups aren't invalidated by a new
  // function each time); reads the live zoom and scroll through a ref.
  const viewRef = useRef({ pps, clientXToTime })
  viewRef.current = { pps, clientXToTime }
  const beginBoundaryDrag: BoundaryDragStart = useCallback(
    (layerId, leftId, rightId) => (e) => {
      const { pps, clientXToTime } = viewRef.current
      e.preventDefault()
      e.stopPropagation()
      // Zoom-aware floor: a neighbor can't be squeezed below MIN_BOUNDARY_DRAG_PX
      // on screen, so a drag never produces an invisibly-small span.
      const minWidth = pps > 0 ? MIN_BOUNDARY_DRAG_PX / pps : MIN_SPAN_WIDTH
      // Every move of one drag joins a single undo step.
      const gesture = newGestureKey('boundary-drag')
      const onMove = (ev: PointerEvent) =>
        withHistoryGroup(gesture, () =>
          setAdjacentBoundary(layerId, leftId, rightId, snapToActiveGrid(clientXToTime(ev.clientX)), minWidth),
        )
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setAdjacentBoundary],
  )

  // Box-drag: start on pointerdown on empty canvas space (spans and boundary
  // handles stop propagation so this only fires on truly empty areas).
  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return // left button only
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || pps <= 0 || layers.length === 0) return

    // Below the layer stack is the marker band, which owns its own gestures.
    // layerIndexAtY clamps, so without this guard a band pointerdown would
    // start a box-drag on the bottom layer.
    if (e.clientY - rect.top >= stackH) return

    e.preventDefault() // prevent text-selection cursor during drag

    const startX = clientXToContent(e.clientX)
    const startY = e.clientY - rect.top
    // Capture the scroll offset at drag start so the rect stays anchored to
    // content even if the analyst scrolls (consistent with boundary drag).
    const capturedScrollOffset = scrollOffset
    const layerIdx = layerIndexAtY(layers, startY)

    dragCommittedRef.current = false
    setBoxDrag({ startX, endX: startX, startY, layerIdx, committed: false })

    const onMove = (ev: PointerEvent) => {
      const endX = capturedScrollOffset + (ev.clientX - rect.left)
      const dx = endX - startX
      const dy = (ev.clientY - rect.top) - startY
      const committed = Math.abs(dx) > BOX_DRAG_THRESHOLD || Math.abs(dy) > BOX_DRAG_THRESHOLD
      setBoxDrag({ startX, endX, startY, layerIdx, committed })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)

      // Read the current drag state from the setter to avoid stale closure.
      setBoxDrag((prev) => {
        if (prev?.committed) {
          dragCommittedRef.current = true
          const lo = Math.min(prev.startX, prev.endX)
          const hi = Math.max(prev.startX, prev.endX)
          const layer = layers[prev.layerIdx]
          if (layer?.type === 'form-diagram') {
            const spans = (layer.data as FormDiagramData).spans
            const overlapping = spans
              .filter((s) => s.startTime * pps < hi && s.endTime * pps > lo)
              .map((s) => s.id)
            if (overlapping.length > 0) setSelection(overlapping)
            else clearSelection()
          }
        }
        return null
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // --- Marker band gestures -------------------------------------------------
  // Click a marker to select it, drag one to reposition. A click on empty band
  // clears the selection like empty canvas does — it no longer places a marker
  // (Devin, 2026-09-27: a stray click wrote data). Markers are placed with M or
  // the control bar's Marker button, at the playhead, so the analyst can keep
  // listening; they drag it afterwards if it needs to move. A pointerdown that
  // landed on a marker suppresses the band's click, since stopPropagation on
  // pointerdown does not stop the click that follows.
  const pointerDownOnMarkerRef = useRef(false)

  function markerSnapCandidates(excludeId?: string): number[] {
    return [
      ...(doc?.sharedTimePoints ?? []).map((p) => p.timestamp),
      ...pointMarkers.filter((m) => m.id !== excludeId).map((m) => m.timestamp),
    ]
  }

  function clampToTrack(t: number): number {
    return Math.max(0, Math.min(duration, t))
  }

  function handleBandClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (pointerDownOnMarkerRef.current) return // the marker's own pointerup selected it
    clearSelection()
  }

  function beginMarkerDrag(marker: PointMarker) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      pointerDownOnMarkerRef.current = true
      if (pps <= 0) return
      const startClientX = e.clientX
      let dragged = false
      const candidates = markerSnapCandidates(marker.id)
      const gesture = newGestureKey('marker-drag') // one drag = one undo step

      const onMove = (ev: PointerEvent) => {
        if (!dragged && Math.abs(ev.clientX - startClientX) > MARKER_DRAG_THRESHOLD_PX) {
          dragged = true
        }
        if (!dragged) return
        const t = clampToTrack(clientXToTime(ev.clientX))
        withHistoryGroup(gesture, () =>
          updatePointMarker(marker.id, {
            // The beat grid wins when snapping is on and the time is inside it;
            // otherwise markers snap to nearby boundaries and markers as before.
            timestamp: snapToActiveGrid(t) !== t ? snapToActiveGrid(t) : snapTime(t, candidates, pps),
          }),
        )
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (!dragged) {
          selectPointMarker(marker.id)
          if (useUIStore.getState().playbackState !== 'playing') useUIStore.getState().requestSeek(marker.timestamp)
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  function handleContainerClick() {
    // Skip clearSelection when this click is the tail of a committed box-drag.
    if (dragCommittedRef.current) {
      dragCommittedRef.current = false
      return
    }
    clearSelection()
  }

  // Selection rectangle rendered during an active box-drag.
  const selRect = boxDrag?.committed
    ? {
        x: Math.min(boxDrag.startX, boxDrag.endX),
        y: shapeTopY(layers, boxDrag.layerIdx),
        width: Math.abs(boxDrag.endX - boxDrag.startX),
        height: layerBodyHeight(layers[boxDrag.layerIdx]),
      }
    : null

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden"
      style={{ background: 'var(--canvas)', height: svgHeight }}
      onPointerDown={handleContainerPointerDown}
      onClick={handleContainerClick}
    >
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: -scrollOffset,
          width: svgWidth,
          height: svgHeight,
          display: 'block',
        }}
      >

        {/* The beat grid, behind everything (editor only for now). */}
        <BeatGridLines grid={doc?.beatGrid} duration={duration} pps={pps} height={svgHeight} />

        {/* The drawing itself: the same pure figure that export uses. */}
        {pps > 0 && (
          <FormDiagramFigure
            layers={layers}
            placements={bandLayout.placements}
            pps={pps}
            totalWidth={totalWidth}
            showCaptions={showCaptions}
            theme={EDITOR_THEME}
            selectedMarkerId={selectedMarkerId}
            Decoration={SelectionHighlight}
          />
        )}

        {/* The interaction layer: invisible targets over the drawing. */}
        {pps > 0 &&
          layers.map((layer, i) => (
            <LayerInteraction
              key={layer.id}
              layer={layer}
              topY={shapeTopY(layers, i)}
              pps={pps}
              onBoundaryDragStart={beginBoundaryDrag}
              dragCommittedRef={dragCommittedRef}
            />
          ))}

        {/* Marker band: empty band clears the selection; markers select and drag. */}
        {pps > 0 && (
          <g>
            <rect
              x={0}
              y={stackH}
              width={svgWidth}
              height={bandLayout.height}
              fill="transparent"
              onPointerDown={() => {
                pointerDownOnMarkerRef.current = false
              }}
              onClick={handleBandClick}
            />
            {bandLayout.placements.map((p) => (
              <MarkerHitTarget key={p.marker.id} placement={p} bandTop={stackH} onPointerDown={reading ? () => undefined : beginMarkerDrag(p.marker)} />
            ))}
          </g>
        )}

        {/* Box-drag selection rectangle */}
        {selRect && (
          <rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.width}
            height={selRect.height}
            fill={SELECT_BLUE}
            fillOpacity={0.08}
            stroke={SELECT_BLUE}
            strokeWidth={1}
            strokeDasharray="3 2"
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Playback cursor — mirrors the ruler cursor so the two read as one line */}
      <Playhead height={svgHeight} opacity={0.5} />

      {/* Quick entry for the selection, on number keys (QuickEntryBar.tsx); not while reading. */}
      {!reading && <QuickEntryBar containerRef={containerRef} layers={layers} pps={pps} scrollOffset={scrollOffset} />}
    </div>
  )
}
