/**
 * The form diagram as a pure drawing — the widget contract's "render component".
 *
 * Nothing here reads a store or handles an event. Given layers, markers, a
 * scale and a colour theme, it returns SVG. That is what lets one drawing serve
 * three places: the editor (which lays an interaction layer on top, see
 * components/FormLayers.tsx), SVG/PDF export (rendered to a string with a print
 * theme), and a future embeddable viewer.
 *
 * The editor needs one thing drawn *inside* each span, between the shape and its
 * text: the selection/hover highlight. It passes that in as `SpanDecoration`, a
 * component, so this module stays free of editor state.
 */
import { memo, type ComponentType } from 'react'
import {
  buildShapePath,
  buildFillPath,
  openJoins,
  capFromBoundaryType,
  lineStyleDash,
  textOnFill,
  truncateToWidth,
  layerLabelLayout,
  spanDrawOrder,
  textX,
  insideTextBox,
  insideTextX,
  ANCHOR,
  layerFonts,
  LABEL_RISE,
  STROKE_WIDTH,
  ISLAND_INSET,
  shapeTopY,
  stackHeight,
  layerBodyHeight,
  type Justification,
  type ResolvedLabel,
} from '@/lib/formShape'
import {
  BAND_TOP_GAP,
  BAND_ROW_HEIGHT,
  BAND_FONT_PX,
  GLYPH_HALF,
  BOX_PAD_X,
  type MarkerPlacement,
} from '@/lib/markerBand'
import type { Layer, Span, FormDiagramData, CapStyle } from '@/types/strata'
import type { FigureTheme } from './theme'

/** A white halo behind text that overhangs the ink of the layer above. */
function halo(theme: FigureTheme) {
  return {
    stroke: theme.canvas,
    strokeWidth: 2.5,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
  }
}

/** Drawn inside a span, after its shape and before its text (the editor's highlight). */
export type SpanDecoration = ComponentType<{ span: Span; width: number; height: number }>

// ── One span ────────────────────────────────────────────────────────────────

function SpanFigure({
  span,
  layer,
  pps,
  labelLayout,
  theme,
  Decoration,
  join,
}: {
  span: Span
  layer: Layer
  /** Sides that join an open-capped neighbour (formShape.openJoins). */
  join?: { start: boolean; end: boolean }
  pps: number
  /** Resolved above-label from the layer's neighbour-aware layout pass. */
  labelLayout?: ResolvedLabel
  theme: FigureTheme
  Decoration?: SpanDecoration
}) {
  const x = span.startTime * pps
  const width = (span.endTime - span.startTime) * pps
  if (width <= 0) return null

  // Key-area ("bar") layers draw a thin flat rect instead of a bracket, and
  // caption with keyArea first (docs/decisions.md "Key-Area Bar Layers").
  const isBar = layer.spanShape === 'bar'
  const bodyHeight = layerBodyHeight(layer)

  // Caps are the analyst's drawing choice; fall back to the boundary type for
  // files written before caps existed.
  const startCap: CapStyle = span.startCap ?? capFromBoundaryType(span.startBoundaryType)
  const endCap: CapStyle = span.endCap ?? capFromBoundaryType(span.endBoundaryType)
  const fill = span.fillColor ?? layer.fillColorDefault
  const stroke = span.strokeColor ?? layer.strokeColorDefault
  const fonts = layerFonts(layer)

  const labelPosition = layer.rendering?.labelPosition ?? 'above'
  const labelJust = (layer.rendering?.labelJustification ?? 'center') as Justification
  const annotationPosition = layer.rendering?.annotationPosition ?? 'inside'
  const annotationJust = (layer.rendering?.annotationJustification ?? 'left') as Justification

  // Local coords: the shape fills y ∈ [0, bodyHeight]; an "above" label sits at
  // negative y, in the open bracket of the layer above. An inside annotation sits
  // high in the body, leaving the lower interior for the child label rising from
  // the layer below.
  const insideLabelY = bodyHeight / 2 + fonts.label * 0.36
  const insideAnnotY = fonts.annotation + 6
  const aboveLabelY = -LABEL_RISE
  const aboveAnnotY = -LABEL_RISE - fonts.label

  // Inside text must fit the body (ellipsis), clear of rounded or angled ends,
  // measured at the text's top; above text may overhang (haloed).
  const labelBox = insideTextBox(width, isBar ? 'square' : startCap, isBar ? 'square' : endCap, insideLabelY - fonts.label * 0.8, bodyHeight)
  const annotBox = insideTextBox(width, isBar ? 'square' : startCap, isBar ? 'square' : endCap, insideAnnotY - fonts.annotation * 0.8, bodyHeight)
  const labelAbove = labelPosition !== 'inside'
  const annotationAbove = annotationPosition === 'above'
  const displayLabel = isBar ? span.keyArea || span.label : span.label
  const labelText = labelAbove
    ? (labelLayout?.text ?? '')
    : displayLabel
      ? truncateToWidth(displayLabel, fonts.label, labelBox.right - labelBox.left)
      : ''
  const annotationText = span.annotation
    ? annotationAbove
      ? span.annotation
      : truncateToWidth(span.annotation, fonts.annotation, annotBox.right - annotBox.left)
    : ''

  const effLabelJust = labelAbove ? (labelLayout?.justification ?? labelJust) : labelJust
  const labelLocalX = labelAbove ? textX(0, width, effLabelJust) : insideTextX(labelBox, effLabelJust)
  const annotationLocalX = annotationAbove ? textX(0, width, annotationJust) : insideTextX(annotBox, annotationJust)
  const textHalo = halo(theme)

  return (
    <g transform={`translate(${x}, 0)`}>
      {isBar ? (
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
        <>
          {/* With an open cap the outline and the fill differ: the fill still
              runs down to the baseline on the open side. */}
          {(startCap === 'open' || endCap === 'open') && (
            <path d={buildFillPath({ width, startCap, endCap, inset: ISLAND_INSET, joinStart: join?.start, joinEnd: join?.end })} fill={fill} stroke="none" />
          )}
          <path
            d={buildShapePath({ width, startCap, endCap, inset: ISLAND_INSET, joinStart: join?.start, joinEnd: join?.end })}
            fill={startCap === 'open' || endCap === 'open' ? 'none' : fill}
            stroke={stroke}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={lineStyleDash(span.lineStyle)}
            strokeLinejoin="round"
            strokeLinecap={join?.start || join?.end ? 'butt' : 'round'}
          />
        </>
      )}

      {Decoration && <Decoration span={span} width={width} height={bodyHeight} />}

      {labelText && (
        <text
          x={labelLocalX}
          y={labelAbove ? aboveLabelY : insideLabelY}
          textAnchor={ANCHOR[effLabelJust]}
          fontSize={fonts.label}
          fontWeight={500}
          fill={labelAbove ? theme.ink : textOnFill(fill, theme.ink)}
          {...(labelAbove ? textHalo : {})}
        >
          {labelText}
        </text>
      )}

      {/* A label with no room is left out rather than marked: in the editor it
          shows on hover or selection (FormLayers' HiddenLabelPeek). */}

      {annotationText && (
        <text
          x={annotationLocalX}
          y={annotationAbove ? aboveAnnotY : insideAnnotY}
          textAnchor={ANCHOR[annotationJust]}
          fontSize={fonts.annotation}
          fontWeight={400}
          fill={annotationAbove ? theme.inkSecondary : textOnFill(fill, theme.inkSecondary)}
          {...(annotationAbove ? textHalo : {})}
        >
          {annotationText}
        </text>
      )}
    </g>
  )
}

// ── One layer ───────────────────────────────────────────────────────────────

/**
 * One layer's spans at its row. Memoized: when only the playhead, scroll or
 * another layer changes, this layer skips its label layout entirely.
 */
export const LayerFigure = memo(function LayerFigure({
  layer,
  topY,
  pps,
  totalWidth,
  theme,
  Decoration,
}: {
  layer: Layer
  topY: number
  pps: number
  totalWidth: number
  theme: FigureTheme
  Decoration?: SpanDecoration
}) {
  if (!layer.visibility) return null
  const labels = layerLabelLayout(layer, pps, totalWidth)
  const joins = openJoins((layer.data as FormDiagramData).spans)
  return (
    <g transform={`translate(0, ${topY})`}>
      {/* Overlap order, not time order, so an elided bracket can sit on top of
          its neighbour when the analyst asks for it (endOnTop). */}
      {spanDrawOrder((layer.data as FormDiagramData).spans).map((span) => (
        <SpanFigure
          key={span.id}
          span={span}
          layer={layer}
          pps={pps}
          labelLayout={labels?.get(span.id)}
          join={joins.get(span.id)}
          theme={theme}
          Decoration={Decoration}
        />
      ))}
    </g>
  )
})

// ── Point markers ───────────────────────────────────────────────────────────

/**
 * One marker: a boxed caption for a cadence, otherwise a diamond with its
 * caption beside it. A caption pushed to a lower row gets a hairline leader
 * back to its glyph.
 */
export function MarkerFigure({
  placement,
  bandTop,
  selected = false,
  showCaptions,
  theme,
}: {
  placement: MarkerPlacement
  bandTop: number
  selected?: boolean
  showCaptions: boolean
  theme: FigureTheme
}) {
  const { marker, x, row, caption, style, struck } = placement
  const color = marker.flagged ? theme.markerFlagged : theme.marker
  const glyphY = bandTop + BAND_TOP_GAP + BAND_ROW_HEIGHT / 2
  const rowY = bandTop + BAND_TOP_GAP + row * BAND_ROW_HEIGHT + BAND_ROW_HEIGHT / 2
  const visibleCaption = showCaptions ? caption : null
  const width = placement.right - placement.left

  if (visibleCaption && style === 'boxed') {
    return (
      <g>
        <rect
          x={placement.left}
          y={rowY - BAND_ROW_HEIGHT / 2 + 1}
          width={width}
          height={BAND_ROW_HEIGHT - 2}
          rx={1}
          fill={theme.canvas}
          stroke={color}
          strokeWidth={selected ? 1.5 : 1}
        />
        <text x={x} y={rowY} textAnchor="middle" dominantBaseline="central" fontSize={BAND_FONT_PX} fill={color}>
          {visibleCaption}
        </text>
        {struck && (
          <line x1={placement.left + BOX_PAD_X} x2={placement.right - BOX_PAD_X} y1={rowY} y2={rowY} stroke={color} strokeWidth={1} />
        )}
      </g>
    )
  }

  return (
    <g>
      {visibleCaption && row > 0 && (
        <line x1={x} x2={x} y1={glyphY} y2={rowY} stroke={color} strokeWidth={0.5} strokeOpacity={0.4} />
      )}
      <rect
        x={-GLYPH_HALF}
        y={-GLYPH_HALF}
        width={GLYPH_HALF * 2}
        height={GLYPH_HALF * 2}
        rx={0.5}
        fill={color}
        stroke={selected ? theme.ring : 'none'}
        strokeWidth={selected ? 2 : 0}
        transform={`translate(${x}, ${glyphY}) rotate(45)`}
      />
      {visibleCaption && (
        <text
          x={x + GLYPH_HALF + 3}
          y={rowY}
          dominantBaseline="central"
          fontSize={BAND_FONT_PX}
          fill={selected ? theme.captionSelected : theme.caption}
          textDecoration={struck ? 'line-through' : undefined}
        >
          {visibleCaption}
        </text>
      )}
    </g>
  )
}

// ── The whole diagram ───────────────────────────────────────────────────────

/**
 * Every visible layer plus the marker band, in the diagram's coordinates
 * (x = seconds × pps; layers stacked from y = 0, the band below them).
 */
export function FormDiagramFigure({
  layers,
  placements,
  pps,
  totalWidth,
  showCaptions,
  theme,
  selectedMarkerId = null,
  Decoration,
}: {
  /** Already sorted for display: macro on top (highest displayOrder first). */
  layers: Layer[]
  placements: MarkerPlacement[]
  pps: number
  totalWidth: number
  showCaptions: boolean
  theme: FigureTheme
  selectedMarkerId?: string | null
  Decoration?: SpanDecoration
}) {
  const bandTop = stackHeight(layers) // the marker band sits under the layer stack
  return (
    <g>
      {layers.map((layer, i) => (
        <LayerFigure
          key={layer.id}
          layer={layer}
          topY={shapeTopY(layers, i)}
          pps={pps}
          totalWidth={totalWidth}
          theme={theme}
          Decoration={Decoration}
        />
      ))}
      {placements.map((p) => (
        <MarkerFigure
          key={p.marker.id}
          placement={p}
          bandTop={bandTop}
          selected={p.marker.id === selectedMarkerId}
          showCaptions={showCaptions}
          theme={theme}
        />
      ))}
    </g>
  )
}
