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
import { computePps } from '@/lib/timeline'
import {
  buildShapePath,
  confidenceStroke,
  textOnFill,
  FONT_SIZES,
  LABEL_RISE,
  SHAPE_HEIGHT,
  STROKE_WIDTH,
  stackHeight,
  shapeTopY,
  type FontScale,
} from '@/lib/formShape'
import { MIN_SPAN_WIDTH, MIN_BOUNDARY_DRAG_PX } from '@/lib/spanEdit'
import type { Layer, Span, FormDiagramData, BoundaryType } from '@/types/strata'

const INK_PRIMARY = 'var(--ink-primary)'
const INK_SECONDARY = '#475569'
const TEXT_PAD = 5 // horizontal inset for left/right-justified text

// Selection styling (BriFormer convention): a light grey box fills the selected
// span's rectangle with a blue outline — the blue reads even when the span
// already has a grey/colored fill. Hover is a fainter grey wash, no outline.
const SELECT_BLUE = '#2563eb'
const SELECT_GREY = '#64748b'

type Justification = 'left' | 'center' | 'right'

const ANCHOR: Record<Justification, 'start' | 'middle' | 'end'> = {
  left: 'start',
  center: 'middle',
  right: 'end',
}

/** Resolve the x and text-anchor for a piece of text given justification. */
function textX(spanX: number, width: number, just: Justification): number {
  if (just === 'center') return spanX + width / 2
  if (just === 'right') return spanX + width - TEXT_PAD
  return spanX + TEXT_PAD
}

interface SpanShapeProps {
  span: Span
  layer: Layer
  pps: number
  fontScale: FontScale
}

function SpanShape({ span, layer, pps, fontScale }: SpanShapeProps) {
  // Per-span subscription: a span only re-renders when ITS own selected/hovered
  // state flips, not on every selection change across the diagram.
  const isSelected = useUIStore((s) => s.selectedSpanId === span.id)
  const isHovered = useUIStore((s) => s.hoveredSpanId === span.id)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const hoverSpan = useUIStore((s) => s.hoverSpan)

  const x = span.startTime * pps
  const width = (span.endTime - span.startTime) * pps
  if (width <= 0) return null

  const lineType = span.lineType ?? 'arc'
  const startBoundary: BoundaryType = span.startBoundaryType ?? 'definite'
  const endBoundary: BoundaryType = span.endBoundaryType ?? 'definite'

  const fill = span.fillColor ?? layer.fillColorDefault
  const stroke = span.strokeColor ?? layer.strokeColorDefault
  const { dash, opacity } = confidenceStroke(span.confidence)

  const path = buildShapePath({ width, lineType, startBoundary, endBoundary })
  const fonts = FONT_SIZES[fontScale]

  // Rendering config — defaults per Phase 0.4 §4 (label above, annotation inside).
  const labelPosition = layer.rendering?.labelPosition ?? 'above'
  const labelJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const annotationPosition = layer.rendering?.annotationPosition ?? 'inside'
  const annotationJust = (layer.rendering?.annotationJustification ?? 'left') as Justification

  // Local coords: the shape occupies y ∈ [0, SHAPE_HEIGHT]. A label "above"
  // sits at a negative y, overhanging up into the open bracket of the layer above.
  const insideY = SHAPE_HEIGHT / 2 + fonts.annotation * 0.36 // optical centering
  const aboveLabelY = -LABEL_RISE
  const aboveAnnotY = -LABEL_RISE - fonts.label // stack annotation above the label if both go up

  return (
    <g
      transform={`translate(${x}, 0)`}
      opacity={opacity}
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => hoverSpan(span.id)}
      onMouseLeave={() => hoverSpan(null)}
      onClick={(e) => {
        e.stopPropagation() // don't let the click bubble to the deselect handler
        selectSpan(span.id)
      }}
    >
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={dash}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

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

      {/* Section label */}
      {span.label && (
        <text
          x={textX(0, width, labelJust)}
          y={labelPosition === 'inside' ? insideY : aboveLabelY}
          textAnchor={ANCHOR[labelJust]}
          fontSize={fonts.label}
          fontWeight={500}
          fill={labelPosition === 'inside' ? textOnFill(fill, INK_PRIMARY) : INK_PRIMARY}
        >
          {span.label}
        </text>
      )}

      {/* Annotation (diagram-visible analytical text) */}
      {span.annotation && (
        <text
          x={textX(0, width, annotationJust)}
          y={annotationPosition === 'above' ? aboveAnnotY : insideY}
          textAnchor={ANCHOR[annotationJust]}
          fontSize={fonts.annotation}
          fontWeight={400}
          fill={
            annotationPosition === 'inside' ? textOnFill(fill, INK_SECONDARY) : INK_SECONDARY
          }
        >
          {span.annotation}
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
  onBoundaryDragStart,
}: {
  layer: Layer
  index: number
  pps: number
  onBoundaryDragStart: BoundaryDragStart
}) {
  if (!layer.visibility) return null
  const data = layer.data as FormDiagramData
  const fontScale: FontScale = 'md' // schema fontScale field pending — default md
  const spans = data.spans
  return (
    <g transform={`translate(0, ${shapeTopY(index)})`}>
      {spans.map((span) => (
        <SpanShape key={span.id} span={span} layer={layer} pps={pps} fontScale={fontScale} />
      ))}

      {/* Boundary drag handles — at each shared edge between adjacent spans.
          Rendered after the shapes so they win pointer events at the edge.
          stopPropagation keeps a drag (or click) from selecting a span. */}
      {spans.map((span, i) => {
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
  const selectSpan = useUIStore((s) => s.selectSpan)
  const setAdjacentBoundary = useDocumentStore((s) => s.setAdjacentBoundary)
  const duration = useDocumentStore((s) => s.document?.duration ?? 0)

  const pps = computePps(duration, viewportWidth, zoom)
  const totalWidth = viewportWidth * zoom
  const svgWidth = Math.max(totalWidth, viewportWidth)
  const visibleCount = layers.filter((l) => l.visibility).length
  const svgHeight = stackHeight(visibleCount)

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
      onClick={() => selectSpan(null)}
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
          layers
            .filter((l) => l.visibility)
            .map((layer, i) => (
              <FormLayerGroup
                key={layer.id}
                layer={layer}
                index={i}
                pps={pps}
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
