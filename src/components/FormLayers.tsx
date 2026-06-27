/**
 * FormLayers — the stack of form-diagram layers rendered above the timeline ruler.
 *
 * This is the read render path: it draws spans from the document store, sharing
 * the timeline's pixel contract (px = time * pps - scrollOffset) with the ruler
 * so shapes line up exactly with tick marks. It reads view state (zoom, scroll,
 * viewport width) from the UI store; the TimelineAxis below owns the controller
 * that writes those values, so this component stays purely presentational for now.
 *
 * Interactions arrive incrementally in Milestone B. Slice 1 (here): click a span
 * to select it, hover to preview; click empty canvas to deselect. Placement and
 * boundary drag come in later slices.
 */

import { useRef } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
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

interface SpanShapeProps {
  span: Span
  layer: Layer
  pps: number
  fontScale: FontScale
  /** Resolved above-label from the layer's neighbour-aware layout pass. */
  labelLayout?: ResolvedLabel
}

function SpanShape({ span, layer, pps, fontScale, labelLayout }: SpanShapeProps) {
  // Per-span subscription: a span only re-renders when ITS own selected/hovered
  // state flips, not on every selection change across the diagram.
  const isSelected = useUIStore((s) => s.selectedSpanIds.includes(span.id))
  const isHovered = useUIStore((s) => s.hoveredSpanId === span.id)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const toggleSpan = useUIStore((s) => s.toggleSpan)
  const setSelection = useUIStore((s) => s.setSelection)
  const hoverSpan = useUIStore((s) => s.hoverSpan)

  // Modifier-aware selection (Merge UX §1):
  //   plain click → single-select
  //   ctrl/cmd-click → toggle this span in/out of the set
  //   shift-click → range-select from the anchor to here, within this layer
  function handleClick(e: React.MouseEvent) {
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

  return (
    <g
      transform={`translate(${x}, 0)`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => hoverSpan(span.id)}
      onMouseLeave={() => hoverSpan(null)}
      onClick={handleClick}
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
  )
}

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
}: {
  layer: Layer
  index: number
  pps: number
  totalWidth: number
  onBoundaryDragStart: BoundaryDragStart
}) {
  if (!layer.visibility) return null
  const data = layer.data as FormDiagramData
  const fontScale: FontScale = 'md' // schema fontScale field pending — default md
  const spans = data.spans

  // Neighbour-aware label layout: one pass over the whole layer so each above-label
  // is truncated to the room it actually has between its neighbours (§7). Only the
  // "above" case needs it — inside-labels are bounded by their own shape body.
  const labelAbove = (layer.rendering?.labelPosition ?? 'above') !== 'inside'
  const baseJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const labelLayout = labelAbove
    ? layoutLayerLabels(
        spans.map((s) => ({
          id: s.id,
          x: s.startTime * pps,
          width: (s.endTime - s.startTime) * pps,
          label: s.label ?? '',
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

  return (
    <div
      ref={containerRef}
      className="relative min-w-0 flex-1 overflow-hidden"
      style={{ background: 'var(--canvas)', height: svgHeight }}
      onClick={() => clearSelection()}
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
            />
          ))}
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
