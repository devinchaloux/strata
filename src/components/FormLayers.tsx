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
  STROKE_WIDTH,
  ISLAND_INSET,
  stackHeight,
  shapeTopY,
  layerBodyHeight,
  layerIndexAtY,
  type FontScale,
  type Justification,
  type ResolvedLabel,
} from '@/lib/formShape'
import {
  layoutMarkerBand,
  BAND_TOP_GAP,
  BAND_ROW_HEIGHT,
  BAND_FONT_PX,
  GLYPH_HALF,
  BOX_PAD_X,
  type MarkerPlacement,
} from '@/lib/markerBand'
import { snapTime } from '@/lib/timeline'
import type { PointMarker, VocabTerm } from '@/types/strata'

// Stable empty references, so a null document doesn't produce a new array on
// every render (which would defeat the store's identity comparison).
const EMPTY_MARKERS: PointMarker[] = []
const EMPTY_TERMS: VocabTerm[] = []

const MARKER_COLOR = 'hsl(var(--primary))'
const MARKER_FLAGGED_COLOR = 'hsl(var(--destructive))'
/** Screen-pixel movement before a marker pointerdown counts as a drag. */
const MARKER_DRAG_THRESHOLD_PX = 3
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

  // Key-area ("bar") layers draw a thin flat rect instead of a bracket — no
  // caps/tails, and the caption is keyArea (falling back to label) rather
  // than label. Purely a rendering choice (docs/decisions.md "Key-Area Bar
  // Layers"); the same Span data and interactions apply either way.
  const isBar = layer.spanShape === 'bar'
  const bodyHeight = layerBodyHeight(layer)

  // Visual caps are the analyst's drawing choice; fall back to the analytical
  // boundary type for files authored before startCap/endCap existed. N/A for bars.
  const startCap: CapStyle = span.startCap ?? capFromBoundaryType(span.startBoundaryType)
  const endCap: CapStyle = span.endCap ?? capFromBoundaryType(span.endBoundaryType)

  const fill = span.fillColor ?? layer.fillColorDefault
  const stroke = span.strokeColor ?? layer.strokeColorDefault
  const dash = lineStyleDash(span.lineStyle)

  // One path per span (fill + stroke), inset so adjacent spans read as islands.
  const path = isBar
    ? ''
    : buildShapePath({ width, startCap, endCap, inset: ISLAND_INSET })
  const elisionLines = isBar
    ? []
    : [
        elisionInnerLine(startCap, 'start', width, bodyHeight, ISLAND_INSET),
        elisionInnerLine(endCap, 'end', width, bodyHeight, ISLAND_INSET),
      ].filter((d): d is string => d !== null)
  const fonts = FONT_SIZES[fontScale]

  // Rendering config — defaults per Phase 0.4 §4 (label above, annotation inside).
  const labelPosition = layer.rendering?.labelPosition ?? 'above'
  const labelJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const annotationPosition = layer.rendering?.annotationPosition ?? 'inside'
  const annotationJust = (layer.rendering?.annotationJustification ?? 'left') as Justification

  // Local coords: the shape occupies y ∈ [0, bodyHeight]. A label "above" sits
  // at a negative y, overhanging up into the open bracket of the layer above.
  // An inside LABEL (e.g. an A/B/C bubble letter) is optically centered, but an
  // inside ANNOTATION sits in the UPPER part of the body — that leaves the lower
  // interior free for the child label rising up from the layer below, which is
  // where most label/annotation collisions came from.
  const insideLabelY = bodyHeight / 2 + fonts.label * 0.36
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
  // On a bar (key-area) layer, the caption is keyArea first, label as a
  // fallback — the whole point of the layer is to surface the key relationship.
  const displayLabel = isBar ? span.keyArea || span.label : span.label
  // Above-labels are resolved by the layer-level layout pass (neighbour-aware
  // truncation + edge re-anchoring). Inside-labels truncate to the shape body.
  const labelText = labelAbove
    ? (labelLayout?.text ?? '')
    : displayLabel
      ? truncateToWidth(displayLabel, fonts.label, innerMax)
      : ''
  const annotationText = span.annotation
    ? annotationAbove
      ? span.annotation
      : truncateToWidth(span.annotation, fonts.annotation, innerMax)
    : ''
  const titleText = [displayLabel, span.type].filter(Boolean).join(' · ')

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

          {isBar ? (
            /* Bar (key-area) layer: a plain flat rect, no caps/tails — islands
               via the same inset gap as brackets, for a consistent visual
               language between layer styles. */
            <rect
              x={ISLAND_INSET}
              y={0}
              width={Math.max(0, width - 2 * ISLAND_INSET)}
              height={bodyHeight}
              rx={1.5}
              fill={fill}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH}
            />
          ) : (
            <path
              d={path}
              fill={fill}
              stroke={stroke}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Elision caps: a lighter inner line marking the overlap (separate stroke,
              never a dash on the bracket itself). N/A for bar layers. */}
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
              height={bodyHeight + 2}
              rx={3}
              fill={SELECT_GREY}
              fillOpacity={isSelected ? 0.2 : 0.08}
              stroke={isSelected ? SELECT_BLUE : 'none'}
              strokeWidth={isSelected ? 1.5 : 0}
            />
          )}

          {/* Transparent hit area — generous, covers the whole shape body so the
              open (white-filled) brackets are easy to click, not just the stroke. */}
          <rect x={0} y={0} width={width} height={bodyHeight} fill="transparent" />

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
  topY,
  pps,
  totalWidth,
  onBoundaryDragStart,
  dragCommittedRef,
}: {
  layer: Layer
  /** Precomputed top-edge y for this layer's row (accounts for bracket/bar variable heights). */
  topY: number
  pps: number
  totalWidth: number
  onBoundaryDragStart: BoundaryDragStart
  dragCommittedRef: React.RefObject<boolean>
}) {
  if (!layer.visibility) return null
  const data = layer.data as FormDiagramData
  const fontScale: FontScale = 'md' // schema fontScale field pending — default md
  const spans = data.spans
  const isBar = layer.spanShape === 'bar'
  const bodyHeight = layerBodyHeight(layer)

  // Neighbour-aware label layout: one pass over the whole layer so each above-label
  // gets whichever of label/shortLabel fits the room it has between its neighbours
  // (§7). Only the "above" case needs it — inside-labels are bounded by their own
  // shape body. A bar (key-area) layer's caption is keyArea first, label as fallback.
  const labelAbove = (layer.rendering?.labelPosition ?? 'above') !== 'inside'
  const baseJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const labelLayout = labelAbove
    ? layoutLayerLabels(
        spans.map((s) => ({
          id: s.id,
          x: s.startTime * pps,
          width: (s.endTime - s.startTime) * pps,
          label: (isBar ? s.keyArea || s.label : s.label) ?? '',
          shortLabel: isBar ? null : s.shortLabel,
        })),
        FONT_SIZES[fontScale].label,
        totalWidth,
        baseJust,
      )
    : null

  return (
    <g transform={`translate(0, ${topY})`}>
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
/**
 * One marker: a boxed caption for a cadence, otherwise a diamond with its
 * caption beside it. When a caption sits on a lower row, a hairline leader
 * connects it back to its glyph so the association survives the offset.
 */
function BandMarker({
  placement,
  bandTop,
  selected,
  showCaptions,
  onPointerDown,
}: {
  placement: MarkerPlacement
  bandTop: number
  selected: boolean
  showCaptions: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const { marker, x, row, caption, style, struck } = placement
  const color = marker.flagged ? MARKER_FLAGGED_COLOR : MARKER_COLOR
  const glyphY = bandTop + BAND_TOP_GAP + BAND_ROW_HEIGHT / 2
  const rowY = bandTop + BAND_TOP_GAP + row * BAND_ROW_HEIGHT + BAND_ROW_HEIGHT / 2
  const visibleCaption = showCaptions ? caption : null
  const width = placement.right - placement.left

  return (
    <g
      onPointerDown={onPointerDown}
      // The container's click clears the span selection, and a click on a
      // marker bubbles to it — which would wipe the selection the pointerup
      // just made. Same trap as the band's place-on-click.
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: 'ew-resize' }}
      role="presentation"
    >
      <title>{marker.label || caption || `Marker at ${marker.timestamp.toFixed(2)}s`}</title>

      {visibleCaption && style === 'boxed' ? (
        <>
          <rect
            x={placement.left}
            y={rowY - BAND_ROW_HEIGHT / 2 + 1}
            width={width}
            height={BAND_ROW_HEIGHT - 2}
            rx={1}
            fill="var(--canvas)"
            stroke={color}
            strokeWidth={selected ? 1.5 : 1}
          />
          <text
            x={x}
            y={rowY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={BAND_FONT_PX}
            fill={color}
          >
            {visibleCaption}
          </text>
          {struck && (
            <line
              x1={placement.left + BOX_PAD_X}
              x2={placement.right - BOX_PAD_X}
              y1={rowY}
              y2={rowY}
              stroke={color}
              strokeWidth={1}
            />
          )}
        </>
      ) : (
        <>
          {/* Leader from the glyph down to an offset caption row */}
          {visibleCaption && row > 0 && (
            <line
              x1={x}
              x2={x}
              y1={glyphY}
              y2={rowY}
              stroke={color}
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
          )}
          <rect
            x={-GLYPH_HALF}
            y={-GLYPH_HALF}
            width={GLYPH_HALF * 2}
            height={GLYPH_HALF * 2}
            rx={0.5}
            fill={color}
            stroke={selected ? 'hsl(var(--ring))' : 'none'}
            strokeWidth={selected ? 2 : 0}
            transform={`translate(${x}, ${glyphY}) rotate(45)`}
          />
          {visibleCaption && (
            <text
              x={x + GLYPH_HALF + 3}
              y={rowY}
              dominantBaseline="central"
              fontSize={BAND_FONT_PX}
              fill={selected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
              textDecoration={struck ? 'line-through' : undefined}
            >
              {visibleCaption}
            </text>
          )}
        </>
      )}
    </g>
  )
}

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

  // Marker band state. Selected via the whole document object rather than
  // `?? []` selectors, which would return a fresh array on every render.
  const doc = useDocumentStore((s) => s.document)
  const addPointMarker = useDocumentStore((s) => s.addPointMarker)
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
  // Mirrors the ruler lane's old model: click empty band to place (snapping),
  // click a marker to select, drag one to reposition. A pointerdown that
  // landed on a marker suppresses the band's place-on-click, since
  // stopPropagation on pointerdown does not stop the click that follows.
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
    e.stopPropagation() // the container's click clears the span selection
    if (pointerDownOnMarkerRef.current || pps <= 0) return
    const time = clampToTrack(clientXToTime(e.clientX))
    const id = crypto.randomUUID()
    addPointMarker({ id, timestamp: snapTime(time, markerSnapCandidates(), pps) })
    selectPointMarker(id)
  }

  function beginMarkerDrag(marker: PointMarker) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      pointerDownOnMarkerRef.current = true
      if (pps <= 0) return
      const startClientX = e.clientX
      let dragged = false
      const candidates = markerSnapCandidates(marker.id)

      const onMove = (ev: PointerEvent) => {
        if (!dragged && Math.abs(ev.clientX - startClientX) > MARKER_DRAG_THRESHOLD_PX) {
          dragged = true
        }
        if (!dragged) return
        const t = clampToTrack(clientXToTime(ev.clientX))
        updatePointMarker(marker.id, { timestamp: snapTime(t, candidates, pps) })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (!dragged) selectPointMarker(marker.id)
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

        {pps > 0 &&
          layers.map((layer, i) => (
            <FormLayerGroup
              key={layer.id}
              layer={layer}
              topY={shapeTopY(layers, i)}
              pps={pps}
              totalWidth={totalWidth}
              onBoundaryDragStart={beginBoundaryDrag}
              dragCommittedRef={dragCommittedRef}
            />
          ))}

        {/* Marker band — document-level markers, inside the diagram so they
            belong to the exported graphic rather than the editor chrome. */}
        {pps > 0 && (
          <g>
            <rect
              x={0}
              y={stackH}
              width={svgWidth}
              height={bandLayout.height}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onPointerDown={() => {
                pointerDownOnMarkerRef.current = false
              }}
              onClick={handleBandClick}
            />
            {bandLayout.placements.map((p) => (
              <BandMarker
                key={p.marker.id}
                placement={p}
                bandTop={stackH}
                selected={p.marker.id === selectedMarkerId}
                showCaptions={showCaptions}
                onPointerDown={beginMarkerDrag(p.marker)}
              />
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
