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

import { useRef, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useMerge } from '@/hooks/useMerge'
import { computePps, totalContentWidth } from '@/lib/timeline'
import {
  buildShapePath,
  capFromBoundaryType,
  lineStyleDash,
  elisionInnerLine,
  textOnFill,
  truncateToWidth,
  layoutLayerLabels,
  textX,
  ANCHOR,
  TEXT_PAD,
  FONT_SIZES,
  LABEL_RISE,
  SHAPE_HEIGHT,
  LAYER_PITCH,
  STACK_TOP_PAD,
  STROKE_WIDTH,
  ISLAND_INSET,
  stackHeight,
  shapeTopY,
  type FontScale,
  type Justification,
  type ResolvedLabel,
} from '@/lib/formShape'
import { MIN_SPAN_WIDTH, MIN_BOUNDARY_DRAG_PX } from '@/lib/spanEdit'
import type { Layer, Span, FormDiagramData, CapStyle } from '@/types/strata'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'

// Lighter ink for the elision cap's inner overlap line (--ink-faint).
const ELISION_INK = '#94a3b8'

const INK_PRIMARY = 'var(--ink-primary)'
const INK_SECONDARY = '#475569'

// Selection styling (BriFormer convention): a light grey box fills the selected
// span's rectangle with a blue outline — the blue reads even when the span
// already has a grey/colored fill. Hover is a fainter grey wash, no outline.
const SELECT_BLUE = '#2563eb'
const SELECT_GREY = '#64748b'

// White halo painted behind negative-space (above-shape) text so a label stays
// legible where it overhangs the ink of the layer above (§7 — legibility before
// layout). paint-order draws the stroke first, the fill on top.
const TEXT_HALO = {
  stroke: 'var(--canvas)',
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  paintOrder: 'stroke' as const,
}

// ---------------------------------------------------------------------------
// Context menu for a single span — used by SpanShape
// ---------------------------------------------------------------------------

function SpanContextMenuContent({ span, layer }: { span: Span; layer: Layer }) {
  const selectedIds = useUIStore((s) => s.selectedSpanIds)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const currentTime = useUIStore((s) => s.currentTime)
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
      <ContextMenuContent>
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
      </ContextMenuContent>
    )
  }

  // Single span: Split / Merge-with-neighbour / Delete.
  return (
    <ContextMenuContent>
      <ContextMenuItem
        disabled={!canSplit}
        onClick={canSplit ? () => placeBoundary(layer.id, currentTime) : undefined}
      >
        Split at playhead
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
// SpanShape
// ---------------------------------------------------------------------------

interface SpanShapeProps {
  span: Span
  layer: Layer
  pps: number
  fontScale: FontScale
  /** Resolved above-label from the layer's neighbour-aware layout pass. */
  labelLayout?: ResolvedLabel
  /** Shared ref: true while a box-drag was just committed — suppresses onClick. */
  dragCommittedRef: React.RefObject<boolean>
}

function SpanShape({ span, layer, pps, fontScale, labelLayout, dragCommittedRef }: SpanShapeProps) {
  // Per-span subscription: a span only re-renders when ITS own selected/hovered
  // state flips, not on every selection change across the diagram.
  const isSelected = useUIStore((s) => s.selectedSpanIds.includes(span.id))
  const isHovered = useUIStore((s) => s.hoveredSpanId === span.id)
  const selectedSpanIds = useUIStore((s) => s.selectedSpanIds)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const toggleSpan = useUIStore((s) => s.toggleSpan)
  const setSelection = useUIStore((s) => s.setSelection)
  const hoverSpan = useUIStore((s) => s.hoverSpan)

  // Modifier-aware selection (Merge UX §1):
  //   plain click → single-select
  //   ctrl/cmd-click → toggle this span in/out of the set
  //   shift-click → range-select from the anchor to here, within this layer
  function handleClick(e: React.MouseEvent) {
    // A box-drag just finished — don't override the rect-based selection.
    // Let the click bubble so the container's handler can reset the ref.
    if (dragCommittedRef.current) return
    e.stopPropagation() // don't let the click bubble to the deselect handler
    if (e.shiftKey) {
      const anchorId = useUIStore.getState().selectionAnchorId
      const layerSpans = (layer.data as FormDiagramData).spans
      const sorted = [...layerSpans].sort((a, b) => a.startTime - b.startTime)
      const anchorIdx = sorted.findIndex((s) => s.id === anchorId)
      // No anchor, or anchor lives in another layer → treat as a plain click.
      if (anchorIdx === -1) {
        selectSpan(span.id)
        return
      }
      const clickedIdx = sorted.findIndex((s) => s.id === span.id)
      const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx]
      const range = sorted.slice(lo, hi + 1).map((s) => s.id)
      setSelection(range, anchorId) // keep the pivot for further shift-clicks
    } else if (e.metaKey || e.ctrlKey) {
      toggleSpan(span.id)
    } else {
      selectSpan(span.id)
    }
  }

  // Right-click: if this span isn't in the current selection, single-select it
  // so the context menu reflects this span. Right-click on an already-selected
  // span (single or multi) leaves the selection intact so multi-merge still works.
  function handleContextMenu() {
    if (!selectedSpanIds.includes(span.id)) {
      selectSpan(span.id)
    }
  }

  const x = span.startTime * pps
  const width = (span.endTime - span.startTime) * pps
  if (width <= 0) return null

  // Visual caps are the analyst's drawing choice; fall back to the analytical
  // boundary type for files authored before startCap/endCap existed.
  const startCap: CapStyle = span.startCap ?? capFromBoundaryType(span.startBoundaryType)
  const endCap: CapStyle = span.endCap ?? capFromBoundaryType(span.endBoundaryType)

  const fill = span.fillColor ?? layer.fillColorDefault
  const stroke = span.strokeColor ?? layer.strokeColorDefault
  const dash = lineStyleDash(span.lineStyle)

  // One path per span (fill + stroke), inset so adjacent spans read as islands.
  const path = buildShapePath({ width, startCap, endCap, inset: ISLAND_INSET })
  const elisionLines = [
    elisionInnerLine(startCap, 'start', width, SHAPE_HEIGHT, ISLAND_INSET),
    elisionInnerLine(endCap, 'end', width, SHAPE_HEIGHT, ISLAND_INSET),
  ].filter((d): d is string => d !== null)
  const fonts = FONT_SIZES[fontScale]

  // Rendering config — defaults per Phase 0.4 §4 (label above, annotation inside).
  const labelPosition = layer.rendering?.labelPosition ?? 'above'
  const labelJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const annotationPosition = layer.rendering?.annotationPosition ?? 'inside'
  const annotationJust = (layer.rendering?.annotationJustification ?? 'left') as Justification

  // Local coords: the shape occupies y ∈ [0, SHAPE_HEIGHT]. A label "above" sits
  // at a negative y, overhanging up into the open bracket of the layer above.
  // An inside LABEL (e.g. an A/B/C bubble letter) is optically centered, but an
  // inside ANNOTATION sits in the UPPER part of the body — that leaves the lower
  // interior free for the child label rising up from the layer below, which is
  // where most label/annotation collisions came from.
  const insideLabelY = SHAPE_HEIGHT / 2 + fonts.label * 0.36
  const insideAnnotY = fonts.annotation + 6
  const aboveLabelY = -LABEL_RISE
  const aboveAnnotY = -LABEL_RISE - fonts.label // stack annotation above the label if both go up

  // Text that sits INSIDE the shape must fit it (truncate with an ellipsis);
  // text ABOVE the shape lives in negative space and may overhang (§3.2), so it
  // is left intact and a halo keeps it legible. Full text is always in the
  // metadata panel and the span tooltip.
  const innerMax = width - 2 * TEXT_PAD
  const labelAbove = labelPosition !== 'inside'
  const annotationAbove = annotationPosition === 'above'
  // Above-labels are resolved by the layer-level layout pass (neighbour-aware
  // truncation + edge re-anchoring). Inside-labels truncate to the shape body.
  const labelText = labelAbove
    ? (labelLayout?.text ?? '')
    : span.label
      ? truncateToWidth(span.label, fonts.label, innerMax)
      : ''
  const annotationText = span.annotation
    ? annotationAbove
      ? span.annotation
      : truncateToWidth(span.annotation, fonts.annotation, innerMax)
    : ''
  const titleText = [span.label, span.type].filter(Boolean).join(' · ')

  const effLabelJust = labelAbove ? (labelLayout?.justification ?? labelJust) : labelJust
  const labelLocalX = textX(0, width, effLabelJust)
  const annotationLocalX = textX(0, width, annotationJust)
  // The hidden-label marker is a point, not text — it never overhangs, so the
  // edge re-anchoring that shifts long labels off-center near the timeline
  // ends doesn't apply to it. It always sits at the span's own base-justified
  // position (labelJust, pre-edge-correction), never left/right-shifted.
  const dotLocalX = textX(0, width, labelJust)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <g
          transform={`translate(${x}, 0)`}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => hoverSpan(span.id)}
          onMouseLeave={() => hoverSpan(null)}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          {/* Native tooltip — full label/type, always reachable on hover even when
              the on-shape text is truncated. */}
          {titleText && <title>{titleText}</title>}

          <path
            d={path}
            fill={fill}
            stroke={stroke}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Elision caps: a lighter inner line marking the overlap (separate stroke,
              never a dash on the bracket itself). */}
          {elisionLines.map((d, i) => (
            <path
              key={`elision-${i}`}
              d={d}
              fill="none"
              stroke={ELISION_INK}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          ))}

          {/* Selection / hover box — drawn OVER the shape so it reads on white or
              colored fills. Hover: faint grey wash. Selected: grey box + blue
              outline (BriFormer convention). Text renders after, staying crisp. */}
          {(isSelected || isHovered) && (
            <rect
              x={-1}
              y={-1}
              width={width + 2}
              height={SHAPE_HEIGHT + 2}
              rx={3}
              fill={SELECT_GREY}
              fillOpacity={isSelected ? 0.2 : 0.08}
              stroke={isSelected ? SELECT_BLUE : 'none'}
              strokeWidth={isSelected ? 1.5 : 0}
            />
          )}

          {/* Transparent hit area — generous, covers the whole shape body so the
              open (white-filled) brackets are easy to click, not just the stroke. */}
          <rect x={0} y={0} width={width} height={SHAPE_HEIGHT} fill="transparent" />

          {/* Section label — above (negative space, haloed) or inside (centered) */}
          {labelText && (
            <text
              x={labelLocalX}
              y={labelAbove ? aboveLabelY : insideLabelY}
              textAnchor={ANCHOR[effLabelJust]}
              fontSize={fonts.label}
              fontWeight={500}
              fill={labelAbove ? INK_PRIMARY : textOnFill(fill, INK_PRIMARY)}
              {...(labelAbove ? TEXT_HALO : {})}
            >
              {labelText}
            </text>
          )}

          {/* Hidden-label marker — a label exists but neither it nor shortLabel
              fit this lane. A quiet dot beats a silent gap: it reads as "there's
              something here" rather than looking like a rendering bug. Full text
              is still in the tooltip and metadata panel. */}
          {labelAbove && labelLayout?.hidden && (
            <circle
              cx={dotLocalX}
              cy={aboveLabelY - fonts.label * 0.32}
              r={1.5}
              fill="var(--ink-faint)"
              {...TEXT_HALO}
            />
          )}

          {/* Annotation — above (haloed) or inside, upper part of the body */}
          {annotationText && (
            <text
              x={annotationLocalX}
              y={annotationAbove ? aboveAnnotY : insideAnnotY}
              textAnchor={ANCHOR[annotationJust]}
              fontSize={fonts.annotation}
              fontWeight={400}
              fill={annotationAbove ? INK_SECONDARY : textOnFill(fill, INK_SECONDARY)}
              {...(annotationAbove ? TEXT_HALO : {})}
            >
              {annotationText}
            </text>
          )}
        </g>
      </ContextMenuTrigger>
      <SpanContextMenuContent span={span} layer={layer} />
    </ContextMenu>
  )
}

// ---------------------------------------------------------------------------
// FormLayerGroup
// ---------------------------------------------------------------------------

/** Begins a boundary drag for the shared edge between two adjacent spans. */
type BoundaryDragStart = (
  layerId: string,
  leftSpanId: string,
  rightSpanId: string,
) => (e: React.PointerEvent) => void

function FormLayerGroup({
  layer,
  index,
  pps,
  totalWidth,
  onBoundaryDragStart,
  dragCommittedRef,
}: {
  layer: Layer
  index: number
  pps: number
  totalWidth: number
  onBoundaryDragStart: BoundaryDragStart
  dragCommittedRef: React.RefObject<boolean>
}) {
  if (!layer.visibility) return null
  const data = layer.data as FormDiagramData
  const fontScale: FontScale = 'md' // schema fontScale field pending — default md
  const spans = data.spans

  // Neighbour-aware label layout: one pass over the whole layer so each above-label
  // gets whichever of label/shortLabel fits the room it has between its neighbours
  // (§7). Only the "above" case needs it — inside-labels are bounded by their own
  // shape body.
  const labelAbove = (layer.rendering?.labelPosition ?? 'above') !== 'inside'
  const baseJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const labelLayout = labelAbove
    ? layoutLayerLabels(
        spans.map((s) => ({
          id: s.id,
          x: s.startTime * pps,
          width: (s.endTime - s.startTime) * pps,
          label: s.label ?? '',
          shortLabel: s.shortLabel,
        })),
        FONT_SIZES[fontScale].label,
        totalWidth,
        baseJust,
      )
    : null

  return (
    <g transform={`translate(0, ${shapeTopY(index)})`}>
      {spans.map((span) => (
        <SpanShape
          key={span.id}
          span={span}
          layer={layer}
          pps={pps}
          fontScale={fontScale}
          labelLayout={labelLayout?.get(span.id)}
          dragCommittedRef={dragCommittedRef}
        />
      ))}

      {/* Boundary drag handles — at each shared edge between adjacent spans.
          Rendered after the shapes so they win pointer events at the edge.
          stopPropagation keeps a drag (or click) from selecting a span.
          Locked layers get no handles (read-only). */}
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
            height={SHAPE_HEIGHT + 4}
            fill="transparent"
            style={{ cursor: 'ew-resize' }}
            onPointerDown={onBoundaryDragStart(layer.id, span.id, next.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )
      })}
    </g>
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

/**
 * @param layers  already sorted for display (macro-on-top: highest displayOrder first)
 */
export function FormLayers({ layers }: { layers: Layer[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const zoom = useUIStore((s) => s.zoom)
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)
  const currentTime = useUIStore((s) => s.currentTime)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const setSelection = useUIStore((s) => s.setSelection)
  const setAdjacentBoundary = useDocumentStore((s) => s.setAdjacentBoundary)
  const duration = useDocumentStore((s) => s.document?.duration ?? 0)

  const pps = computePps(zoom)
  const totalWidth = totalContentWidth(duration, zoom)
  const svgWidth = Math.max(totalWidth, viewportWidth)
  // Every layer keeps a slot (hidden ones render empty) so the header column and
  // the canvas stay row-aligned; FormLayerGroup draws nothing for hidden layers.
  const svgHeight = stackHeight(layers.length)

  const cursorPx = pps > 0 ? currentTime * pps - scrollOffset : -1
  const cursorVisible = cursorPx >= 0 && cursorPx <= viewportWidth

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
  const beginBoundaryDrag: BoundaryDragStart =
    (layerId, leftId, rightId) => (e) => {
      e.preventDefault()
      e.stopPropagation()
      // Zoom-aware floor: a neighbor can't be squeezed below MIN_BOUNDARY_DRAG_PX
      // on screen, so a drag never produces an invisibly-small span.
      const minWidth = pps > 0 ? MIN_BOUNDARY_DRAG_PX / pps : MIN_SPAN_WIDTH
      const onMove = (ev: PointerEvent) =>
        setAdjacentBoundary(layerId, leftId, rightId, clientXToTime(ev.clientX), minWidth)
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

  // Box-drag: start on pointerdown on empty canvas space (spans and boundary
  // handles stop propagation so this only fires on truly empty areas).
  function handleContainerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return // left button only
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || pps <= 0 || layers.length === 0) return

    e.preventDefault() // prevent text-selection cursor during drag

    const startX = clientXToContent(e.clientX)
    const startY = e.clientY - rect.top
    // Capture the scroll offset at drag start so the rect stays anchored to
    // content even if the analyst scrolls (consistent with boundary drag).
    const capturedScrollOffset = scrollOffset
    const layerIdx = Math.max(
      0,
      Math.min(layers.length - 1, Math.floor((startY - STACK_TOP_PAD) / LAYER_PITCH)),
    )

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
        y: shapeTopY(boxDrag.layerIdx),
        width: Math.abs(boxDrag.endX - boxDrag.startX),
        height: SHAPE_HEIGHT,
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

        {pps > 0 &&
          layers.map((layer, i) => (
            <FormLayerGroup
              key={layer.id}
              layer={layer}
              index={i}
              pps={pps}
              totalWidth={totalWidth}
              onBoundaryDragStart={beginBoundaryDrag}
              dragCommittedRef={dragCommittedRef}
            />
          ))}

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
      {cursorVisible && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: cursorPx,
            width: 1,
            height: svgHeight,
            backgroundColor: 'hsl(var(--primary))',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
