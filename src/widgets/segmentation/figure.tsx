/**
 * The Segments block as a pure drawing — the widget contract's "render component".
 *
 * Nothing here reads a store or handles an event. Given layers, markers, a
 * scale and a colour theme, it returns SVG. That is what lets one drawing serve
 * three places: the editor (which lays an interaction layer on top, see
 * components/SegmentLayers.tsx), SVG/PDF export (rendered to a string with a print
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
  estimateTextWidth,
  layerLabelLayout,
  spanDrawOrder,
  textX,
  insideTextBox,
  insideTextX,
  ANCHOR,
  layerFonts,
  LABEL_RISE,
  STRIP_HEIGHT,
  labelLift as liftFor,
  STROKE_WIDTH,
  ISLAND_INSET,
  shapeTopY,
  stackHeight,
  layerBodyHeight,
  type Justification,
  type ResolvedLabel,
} from '@/lib/segmentShape'
import {
  BAND_TOP_GAP,
  BAND_ROW_HEIGHT,
  BAND_FONT_PX,
  GLYPH_HALF,
  BOX_PAD_X,
  type MarkerPlacement,
} from '@/lib/markerBand'
import type { Layer, Span, SegmentationData, CapStyle } from '@/types/strata'
import type { FigureTheme } from './theme'
import { PATTERN_TILE, patternInk, patternMarks } from '@/lib/patterns'
import { hypermeterShown, hypermeterText } from '@/lib/hypermeter'
import { TEMPO_LANE_HEIGHT, tempoY, type TempoLane } from '@/lib/tempoLane'

/** A white halo behind text that overhangs the ink of the layer above. */
function halo(theme: FigureTheme) {
  return {
    stroke: theme.canvas,
    strokeWidth: 2.5,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
  }
}

/** Space between a hypermeter and an annotation sharing its line, in px. */
const HYPER_GAP = 4
/** The smallest a hypermeter is drawn to fit a narrow span, as a share of the annotation size. */
const HYPER_MIN_SCALE = 0.7

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
  labelLift = 0,
}: {
  span: Span
  layer: Layer
  /** How much higher above-labels sit, clearing the strip of the layer above (segmentShape.labelLift). */
  labelLift?: number
  /** Sides that join an open-capped neighbour (segmentShape.openJoins). */
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
  const stored = span.fillColor ?? layer.fillColorDefault
  const fill = theme.mapFill ? theme.mapFill(stored) : stored
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
  const aboveLabelY = -LABEL_RISE - labelLift
  const aboveAnnotY = aboveLabelY - fonts.label
  // The layer's strip under its shapes (rendering.underneath), when it has one.
  const underneath = layer.rendering?.underneath
  const stripY = bodyHeight + STRIP_HEIGHT - 3
  // The strip has no caps to keep clear of: only the gap between spans.
  const stripBox = { left: ISLAND_INSET + 1, right: width - ISLAND_INSET - 1 }

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

  // The hypermeter (lib/hypermeter.ts) is centered, inside on the annotation's
  // line or in the strip under the layer, and never replaces the annotation.
  // Sharing a line, the annotation stops short of it (a centered one takes the
  // left side); with either in the strip, the other has its line to itself. A
  // count short of room is drawn smaller, down to HYPER_MIN_SCALE, so the
  // widest ("4=1", the elided one) survives narrow bars; only then is it left
  // out, whole.
  const hyperUnder = underneath === 'hypermeter'
  const annotUnder = underneath === 'annotation'
  const hyperBox = hyperUnder ? stripBox : annotBox
  const hyperRaw = span.hypermeter && hypermeterShown(span, layer) ? hypermeterText(span.hypermeter) : ''
  const hyperRoom = hyperBox.right - hyperBox.left
  const hyperFull = estimateTextWidth(hyperRaw, fonts.annotation)
  const hyperSize = hyperFull > hyperRoom ? Math.max(fonts.annotation * HYPER_MIN_SCALE, (fonts.annotation * hyperRoom) / hyperFull) : fonts.annotation
  const hyperWidth = estimateTextWidth(hyperRaw, hyperSize)
  // Shrunk to fit exactly, it can come out a hair over in floating point.
  const hyperText = hyperRaw && hyperWidth <= hyperRoom + 0.01 ? hyperRaw : ''
  const hyperX = (hyperBox.left + hyperBox.right) / 2
  const hyperY = hyperUnder ? stripY : insideAnnotY
  const besideHyper = !!hyperText && !hyperUnder && !annotUnder && !annotationAbove
  const annotY = annotUnder ? stripY : annotationAbove ? aboveAnnotY : insideAnnotY
  const annotRoom = annotUnder
    ? stripBox
    : besideHyper
      ? annotationJust === 'right'
        ? { left: hyperX + hyperWidth / 2 + HYPER_GAP, right: annotBox.right }
        : { left: annotBox.left, right: hyperX - hyperWidth / 2 - HYPER_GAP }
      : annotBox
  // Sharing a line with the count, a centered annotation keeps to the left.
  const annotJust: Justification = besideHyper && annotationJust === 'center' ? 'left' : annotationJust
  const annotationText = span.annotation
    ? annotationAbove && !annotUnder
      ? span.annotation
      : truncateToWidth(span.annotation, fonts.annotation, Math.max(0, annotRoom.right - annotRoom.left))
    : ''

  const effLabelJust = labelAbove ? (labelLayout?.justification ?? labelJust) : labelJust
  const labelLocalX = labelAbove ? textX(0, width, effLabelJust) : insideTextX(labelBox, effLabelJust)
  const annotOutside = annotationAbove && !annotUnder
  const annotationLocalX = annotOutside ? textX(0, width, annotJust) : insideTextX(annotRoom, annotJust)
  const annotInk = annotOutside || annotUnder ? theme.inkSecondary : textOnFill(fill, theme.inkSecondary)
  const textHalo = halo(theme)

  // Shape and fill outlines, and the span's fill pattern (lib/patterns.ts):
  // marks in a darker shade of the fill as drawn, tiled from the span's own
  // corner. The id is the span's, so it is unique in the figure.
  const openCap = startCap === 'open' || endCap === 'open'
  const shapePath = isBar ? '' : buildShapePath({ width, startCap, endCap, inset: ISLAND_INSET, joinStart: join?.start, joinEnd: join?.end })
  const fillPath = isBar ? '' : openCap ? buildFillPath({ width, startCap, endCap, inset: ISLAND_INSET, joinStart: join?.start, joinEnd: join?.end }) : shapePath
  const marks = patternMarks(span.fillPattern)
  const patternId = `fill-pattern-${span.id}`
  const markInk = patternInk(fill)
  const patternDefs = marks && (
    <defs>
      <pattern id={patternId} patternUnits="userSpaceOnUse" width={PATTERN_TILE} height={PATTERN_TILE}>
        <path
          d={marks.d}
          fill={marks.dots ? markInk : 'none'}
          stroke={marks.dots ? 'none' : markInk}
          strokeWidth={0.9}
          opacity={0.7}
        />
      </pattern>
    </defs>
  )

  return (
    <g transform={`translate(${x}, 0)`}>
      {patternDefs}
      {isBar ? (
        <>
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
          {marks && (
            <rect
              x={ISLAND_INSET + 1}
              y={1}
              width={Math.max(0, width - 2 * ISLAND_INSET - 2)}
              height={Math.max(0, bodyHeight - 2)}
              fill={`url(#${patternId})`}
              stroke="none"
            />
          )}
        </>
      ) : (
        <>
          {/* With an open cap the outline and the fill differ: the fill still
              runs down to the baseline on the open side. A pattern sits on the
              fill, under the outline, so its marks never cross the line. */}
          {(openCap || marks) && <path d={fillPath} fill={fill} stroke="none" />}
          {marks && <path d={fillPath} fill={`url(#${patternId})`} stroke="none" />}
          <path
            d={shapePath}
            fill={openCap || marks ? 'none' : fill}
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
          shows on hover or selection (SegmentLayers' HiddenLabelPeek). */}

      {annotationText && (
        <text
          x={annotationLocalX}
          y={annotY}
          textAnchor={ANCHOR[annotJust]}
          fontSize={fonts.annotation}
          fontWeight={400}
          fill={annotInk}
          {...(annotOutside ? textHalo : {})}
        >
          {annotationText}
        </text>
      )}

      {hyperText && (
        <text
          x={hyperX}
          y={hyperY}
          textAnchor="middle"
          fontSize={hyperSize}
          fontWeight={500}
          fill={hyperUnder ? theme.ink : textOnFill(fill, theme.ink)}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {hyperText}
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
  labelLift = 0,
}: {
  layer: Layer
  topY: number
  /** How much higher its above-labels sit, clearing the strip of the layer above. */
  labelLift?: number
  pps: number
  totalWidth: number
  theme: FigureTheme
  Decoration?: SpanDecoration
}) {
  if (!layer.visibility) return null
  const labels = layerLabelLayout(layer, pps, totalWidth)
  const joins = openJoins((layer.data as SegmentationData).spans)
  return (
    <g transform={`translate(0, ${topY})`}>
      {/* Overlap order, not time order, so an elided bracket can sit on top of
          its neighbour when the analyst asks for it (endOnTop). */}
      {spanDrawOrder((layer.data as SegmentationData).spans).map((span) => (
        <SpanFigure
          key={span.id}
          span={span}
          layer={layer}
          pps={pps}
          labelLayout={labels?.get(span.id)}
          join={joins.get(span.id)}
          theme={theme}
          Decoration={Decoration}
          labelLift={labelLift}
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

// ── Tempo ───────────────────────────────────────────────────────────────────

/**
 * A layer of bars' tempo as a step line, one level per bar, in a band from
 * `top` (lib/tempoLane.ts). Guide lines at round tempos; with `labels`, their
 * values at the band's left edge. Each bar carries a hover title: "Bar 37:
 * 103 BPM". Groundwork for the tempo widget (widgets/tempo.md), not drawn yet.
 */
export function TempoLaneFigure({
  lane,
  top,
  pps,
  totalWidth,
  theme,
  labels = true,
}: {
  lane: TempoLane
  top: number
  pps: number
  totalWidth: number
  theme: FigureTheme
  labels?: boolean
}) {
  const y = (bpm: number) => tempoY(bpm, lane.scale, top)
  let d = ''
  lane.steps.forEach((s, k) => {
    const x0 = s.start * pps
    const x1 = s.end * pps
    const prev = lane.steps[k - 1]
    d += prev && Math.abs(prev.end - s.start) < 1e-6 ? ` L${x0},${y(s.bpm)}` : ` M${x0},${y(s.bpm)}`
    d += ` L${x1},${y(s.bpm)}`
  })
  return (
    <g>
      <line x1={0} x2={totalWidth} y1={top + 0.5} y2={top + 0.5} stroke={theme.inkFaint} strokeOpacity={0.5} strokeWidth={1} />
      {lane.scale.ticks.map((t) => (
        <line key={t} x1={0} x2={totalWidth} y1={y(t)} y2={y(t)} stroke={theme.inkFaint} strokeOpacity={0.5} strokeWidth={0.75} strokeDasharray="2 3" />
      ))}
      {labels &&
        lane.scale.ticks.map((t) => (
          <text key={t} x={2} y={y(t) - 2} fontSize={8.5} fill={theme.caption}>
            {t === lane.scale.max ? `${t} BPM` : t}
          </text>
        ))}
      <path d={d.trim()} fill="none" stroke={theme.ink} strokeWidth={1.5} strokeLinejoin="round" />
      {lane.steps.map((s, k) => (
        <rect key={k} x={s.start * pps} y={top} width={Math.max(0, (s.end - s.start) * pps)} height={TEMPO_LANE_HEIGHT} fill="transparent">
          <title>{`${s.bar ? `Bar ${s.bar}: ` : ''}${Math.round(s.bpm * 10) / 10} BPM`}</title>
        </rect>
      ))}
    </g>
  )
}

// ── The whole diagram ───────────────────────────────────────────────────────

/**
 * Every visible layer plus the marker band, in the diagram's coordinates
 * (x = seconds × pps; layers stacked from y = 0, the band below them).
 */
export function SegmentationFigure({
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
          labelLift={liftFor(layers, i)}
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
