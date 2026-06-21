/**
 * FormLayers — the stack of form-diagram layers rendered above the timeline ruler.
 *
 * This is the read render path: it draws spans from the document store, sharing
 * the timeline's pixel contract (px = time * pps - scrollOffset) with the ruler
 * so shapes line up exactly with tick marks. It reads view state (zoom, scroll,
 * viewport width) from the UI store; the TimelineAxis below owns the controller
 * that writes those values, so this component stays purely presentational for now.
 *
 * Interactions (selection, hover, spacebar placement, boundary drag) arrive in
 * Milestone B — this milestone is the static visual foundation only.
 */

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
import type { Layer, Span, FormDiagramData, BoundaryType } from '@/types/strata'

const INK_PRIMARY = 'var(--ink-primary)'
const INK_SECONDARY = '#475569'
const TEXT_PAD = 5 // horizontal inset for left/right-justified text

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
    <g transform={`translate(${x}, 0)`} opacity={opacity}>
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={dash}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

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

function FormLayerGroup({
  layer,
  index,
  pps,
}: {
  layer: Layer
  index: number
  pps: number
}) {
  if (!layer.visibility) return null
  const data = layer.data as FormDiagramData
  const fontScale: FontScale = 'md' // schema fontScale field pending — default md
  return (
    <g transform={`translate(0, ${shapeTopY(index)})`}>
      {data.spans.map((span) => (
        <SpanShape key={span.id} span={span} layer={layer} pps={pps} fontScale={fontScale} />
      ))}
    </g>
  )
}

/**
 * @param layers  already sorted for display (macro-on-top: highest displayOrder first)
 */
export function FormLayers({ layers }: { layers: Layer[] }) {
  const zoom = useUIStore((s) => s.zoom)
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)
  const currentTime = useUIStore((s) => s.currentTime)
  const duration = useDocumentStore((s) => s.document?.duration ?? 0)

  const pps = computePps(duration, viewportWidth, zoom)
  const totalWidth = viewportWidth * zoom
  const svgWidth = Math.max(totalWidth, viewportWidth)
  const visibleCount = layers.filter((l) => l.visibility).length
  const svgHeight = stackHeight(visibleCount)

  const cursorPx = pps > 0 ? currentTime * pps - scrollOffset : -1
  const cursorVisible = cursorPx >= 0 && cursorPx <= viewportWidth

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden"
      style={{ background: 'var(--canvas)', height: svgHeight }}
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
              <FormLayerGroup key={layer.id} layer={layer} index={i} pps={pps} />
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
