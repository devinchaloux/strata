/**
 * Pure geometry + color helpers for form-diagram span shapes.
 *
 * No React, no DOM. Everything here is a pure function so it can be unit-tested
 * and reused by both the editor render path and (later) the embeddable viewer.
 *
 * Shape model (per Phase 0.4 §3 + Phase 0.7 §4):
 *   A span is an OPEN bracket or an arc "bubble" — never a filled rectangle.
 *   - lineType 'flat' → flat horizontal top with two tails dropping to the
 *     baseline. The tails carry the boundary character (definite/gradual).
 *   - lineType 'arc'  → domed top (the classic bubble) sitting on the baseline.
 *
 * Coordinate convention: every path is built in LOCAL space where the shape
 * spans x ∈ [0, w], the top edge is y = 0, and the baseline is y = H. The
 * caller translates the group to the span's pixel x and the layer's y.
 *
 * Why an open path that we still fill: SVG fills an open subpath as if it were
 * closed along a straight line from the last point back to the first. For our
 * brackets that implicit close runs along the baseline — so a white fill makes
 * the bracket read as "open" (only the stroke shows) while a colored fill makes
 * a solid bubble. One path, two visual idioms, no special-casing.
 */

import type { BoundaryType, LineType, ConfidenceLevel } from '@/types/strata'

// ---------------------------------------------------------------------------
// Metrics (starting values — Phase 0.7 §8; tweakable once seen on real data)
// ---------------------------------------------------------------------------

export const SHAPE_HEIGHT = 28 // uniform across all layers (the BriFormer cue)
export const CORNER_RADIUS = 6 // definite tail corner curve
export const GRADUAL_INSET = 9 // horizontal run of an angled (gradual) tail
export const STROKE_WIDTH = 1.5

/**
 * Vertical anatomy — flush stacking (Phase 0.7 §3, model A).
 *
 * Layers stack with only a hairline gap so that boundaries shared across layers
 * line up into continuous vertical lines (that alignment IS how hierarchy reads;
 * no bracket is taller than another, none encloses another). A layer's label is
 * NOT given its own reserved row — it is drawn just above the shape, overhanging
 * up into the open interior (negative space) of the bracket above it.
 *
 *   LAYER_PITCH  vertical advance per layer = shape + hairline gap
 *   STACK_TOP_PAD  headroom above the top layer for its label (no layer above it)
 *   LABEL_RISE   how far a label baseline sits above its shape's top edge
 */
export const LAYER_GAP = 3
export const LAYER_PITCH = SHAPE_HEIGHT + LAYER_GAP
export const STACK_TOP_PAD = 18
export const LABEL_RISE = 4

/** Total pixel height of a flush stack of n visible layers. */
export function stackHeight(layerCount: number): number {
  return STACK_TOP_PAD + layerCount * LAYER_PITCH
}

/** Top-edge y of the shape for layer index i (0 = top of the stack). */
export function shapeTopY(i: number): number {
  return STACK_TOP_PAD + i * LAYER_PITCH
}

// ---------------------------------------------------------------------------
// Boundary alignment — continuous vertical lines across layers (§3.3 / §4.2)
//
// When a boundary lines up across flush-stacked layers, the aligned tails
// should read as ONE vertical line down the stack — that alignment is how
// nesting is shown (never bracket size). The shapes already place their tails
// at the boundary x; what interrupts the line is the inter-layer gap plus each
// shape's rounded top corner curving away. We bridge that span with a thin
// connector (see the renderer), but only where a clean vertical tail exists on
// both sides: a flat bracket with a definite boundary. Arcs have no tail and
// gradual tails are diagonal, so neither participates.
// ---------------------------------------------------------------------------

export interface SpanEdge {
  startTime: number
  endTime: number
  lineType?: LineType | null
  startBoundaryType?: BoundaryType | null
  endBoundaryType?: BoundaryType | null
}

const TIME_EPS = 1e-4

/**
 * Times at which a span presents a clean vertical tail (flat bracket + definite
 * boundary). Sorted ascending and de-duplicated within epsilon.
 */
export function verticalBoundaryTimes(spans: SpanEdge[]): number[] {
  const out: number[] = []
  for (const s of spans) {
    if (s.lineType !== 'flat') continue
    if ((s.startBoundaryType ?? 'definite') === 'definite') out.push(s.startTime)
    if ((s.endBoundaryType ?? 'definite') === 'definite') out.push(s.endTime)
  }
  out.sort((a, b) => a - b)
  const dedup: number[] = []
  for (const t of out) {
    if (dedup.length === 0 || Math.abs(t - dedup[dedup.length - 1]) > TIME_EPS) dedup.push(t)
  }
  return dedup
}

/** Times present in BOTH ascending, de-duped lists (within epsilon). */
export function sharedTimes(a: number[], b: number[], eps = TIME_EPS): number[] {
  const out: number[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const d = a[i] - b[j]
    if (Math.abs(d) <= eps) {
      out.push((a[i] + b[j]) / 2)
      i++
      j++
    } else if (d < 0) {
      i++
    } else {
      j++
    }
  }
  return out
}

/**
 * Vertical extent [y1, y2] of the connector that joins the bottom layer index
 * `upper`'s baseline to the top of the next layer's vertical tail, closing the
 * gap + corner so the boundary reads as one continuous line.
 */
export function connectorSpanY(upper: number): { y1: number; y2: number } {
  return {
    y1: shapeTopY(upper) + SHAPE_HEIGHT, // upper baseline (tail bottom is vertical)
    y2: shapeTopY(upper + 1) + CORNER_RADIUS, // where the lower tail's vertical begins
  }
}

// ---------------------------------------------------------------------------
// Font scale (Phase 0.7 §5 — layer-level fontScale enum)
// ---------------------------------------------------------------------------

export type FontScale = 'sm' | 'md' | 'lg'

export const FONT_SIZES: Record<FontScale, { label: number; annotation: number }> = {
  sm: { label: 9.5, annotation: 8.5 },
  md: { label: 11, annotation: 9 },
  lg: { label: 13, annotation: 11 },
}

// ---------------------------------------------------------------------------
// Path construction
// ---------------------------------------------------------------------------

export interface ShapePathOptions {
  width: number
  height?: number
  lineType: LineType
  startBoundary: BoundaryType
  endBoundary: BoundaryType
}

/**
 * Build the SVG path `d` string for a span shape in local coordinates.
 * The returned path is open (no `Z`); fill closes it along the baseline.
 */
export function buildShapePath({
  width,
  height = SHAPE_HEIGHT,
  lineType,
  startBoundary,
  endBoundary,
}: ShapePathOptions): string {
  const w = Math.max(width, 0)
  const H = height

  // Arc / bubble: a single elliptical dome from baseline to baseline.
  // rx = w/2 makes it a half-ellipse so the peak height equals H — keeping the
  // arc the SAME height as flat brackets (uniform-height rule). Boundary caps
  // are not expressed on arcs in v1 (deferred — see spec §10).
  if (lineType === 'arc') {
    if (w <= 0) return ''
    return `M 0 ${H} A ${w / 2} ${H} 0 0 1 ${w} ${H}`
  }

  // Flat bracket: top line + two tails. Corner radius is only meaningful when
  // the span is wide enough to host two corners.
  const r = Math.min(CORNER_RADIUS, w / 2, H)
  const inset = Math.min(GRADUAL_INSET, w / 2)

  const parts: string[] = []

  // --- Left tail ---
  if (startBoundary === 'gradual') {
    // Angled tail: baseline starts inset to the right, ramps up to the corner.
    parts.push(`M ${inset} ${H}`, `L 0 0`)
  } else {
    // Definite (and elided, treated as definite in v1 static): vertical tail
    // with a rounded top-left corner.
    parts.push(`M 0 ${H}`, `L 0 ${r}`, `A ${r} ${r} 0 0 1 ${r} 0`)
  }

  // --- Top line ---
  const topRightX = endBoundary === 'gradual' ? w : w - r
  parts.push(`L ${topRightX} 0`)

  // --- Right tail ---
  if (endBoundary === 'gradual') {
    parts.push(`L ${w - inset} ${H}`)
  } else {
    parts.push(`A ${r} ${r} 0 0 1 ${w} ${r}`, `L ${w} ${H}`)
  }

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Text fitting (Phase 0.7 §7 — collision strategy: abbreviation)
//
// Negative-space labels (positioned ABOVE a shape) are allowed to overflow into
// the open interior of the layer above (§3.2) and are left intact. Text placed
// INSIDE a shape body must respect the shape bounds, so it is truncated with an
// ellipsis. Width is estimated, not measured, so this stays a pure function: a
// slightly conservative average advance keeps truncation from overflowing.
// ---------------------------------------------------------------------------

// Average glyph advance as a fraction of font size for Inter at small sizes.
// Deliberately a touch generous so estimates never under-shoot real width.
const AVG_CHAR_ADVANCE = 0.58
const ELLIPSIS = '…'

/** Rough pixel width of `text` at `fontPx`. Estimate, not a measurement. */
export function estimateTextWidth(text: string, fontPx: number): number {
  return text.length * fontPx * AVG_CHAR_ADVANCE
}

/**
 * Truncate `text` so it fits within `maxWidthPx` at `fontPx`, appending an
 * ellipsis when shortened. Returns '' when not even one character plus the
 * ellipsis fits (the caller then renders nothing — full text remains available
 * in the metadata panel and the span's title tooltip).
 */
export function truncateToWidth(text: string, fontPx: number, maxWidthPx: number): string {
  if (!text) return ''
  if (maxWidthPx <= 0) return ''
  if (estimateTextWidth(text, fontPx) <= maxWidthPx) return text
  const ellipsisW = estimateTextWidth(ELLIPSIS, fontPx)
  // Largest prefix whose width + ellipsis still fits.
  let n = 0
  while (
    n < text.length &&
    estimateTextWidth(text.slice(0, n + 1), fontPx) + ellipsisW <= maxWidthPx
  ) {
    n++
  }
  return n === 0 ? '' : text.slice(0, n).trimEnd() + ELLIPSIS
}

/**
 * The two tail sub-paths of a flat bracket (left and right), in the same local
 * coords as buildShapePath. Used to overdraw the tails SOLID on a dashed
 * (approximate/speculative) span: confidence dashes the section *body*, but the
 * tails are shared *boundaries* (their character is boundaryType, not
 * confidence), so they must stay solid — otherwise adjacent dashed + solid tails
 * collide into a messy line at a shared boundary. Arcs have no tails.
 */
export function buildTailPaths({
  width,
  height = SHAPE_HEIGHT,
  lineType,
  startBoundary,
  endBoundary,
}: ShapePathOptions): { left: string; right: string } {
  if (lineType === 'arc') return { left: '', right: '' }
  const w = Math.max(width, 0)
  const H = height
  const r = Math.min(CORNER_RADIUS, w / 2, H)
  const inset = Math.min(GRADUAL_INSET, w / 2)
  const left =
    startBoundary === 'gradual'
      ? `M ${inset} ${H} L 0 0`
      : `M 0 ${H} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`
  const right =
    endBoundary === 'gradual'
      ? `M ${w} 0 L ${w - inset} ${H}`
      : `M ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${H}`
  return { left, right }
}

/**
 * The stroke path for a span's TOP — the part that carries `confidence` (dashed
 * for approximate/speculative). It is the top line / dome plus the rounded
 * corners and any GRADUAL (diagonal) tails, but NOT the vertical part of a
 * definite/elided tail: those verticals are the *shared boundary* between adjacent
 * spans and are drawn once by the boundary pass (see `boundaryTails`) so adjacent
 * tails never double-stamp a pixel.
 *
 * Corners stay here rather than moving to the boundary pass because an interior
 * boundary has TWO corners — one curving into each neighbour's top — that genuinely
 * belong to different spans and curve apart; only the bare vertical is shared.
 * Arcs have no tails, so the dome is returned whole (and carries confidence).
 */
export function buildTopPath({
  width,
  height = SHAPE_HEIGHT,
  lineType,
  startBoundary,
  endBoundary,
}: ShapePathOptions): string {
  const w = Math.max(width, 0)
  const H = height

  if (lineType === 'arc') {
    if (w <= 0) return ''
    return `M 0 ${H} A ${w / 2} ${H} 0 0 1 ${w} ${H}`
  }

  const r = Math.min(CORNER_RADIUS, w / 2, H)
  const inset = Math.min(GRADUAL_INSET, w / 2)
  const parts: string[] = []

  // --- Left ---
  if (startBoundary === 'gradual') {
    // Angled tail stays with the top (diagonals angle apart, never double-stamp).
    parts.push(`M ${inset} ${H}`, `L 0 0`)
  } else {
    // Definite/elided: corner only, starting at the top of the shared vertical.
    parts.push(`M 0 ${r}`, `A ${r} ${r} 0 0 1 ${r} 0`)
  }

  // --- Top line ---
  const topRightX = endBoundary === 'gradual' ? w : w - r
  parts.push(`L ${topRightX} 0`)

  // --- Right ---
  if (endBoundary === 'gradual') {
    parts.push(`L ${w - inset} ${H}`)
  } else {
    // Corner only — stop at the top of the shared vertical (no `L w H`).
    parts.push(`A ${r} ${r} 0 0 1 ${w} ${r}`)
  }

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Shared boundary tails (the adjoin model)
//
// Each definite/elided boundary in a layer is drawn ONCE as a vertical segment
// from the corner foot (y = r) down to the baseline (y = H). Adjacent spans that
// share a boundary collapse to a single tail — that is the whole point: solid
// tails stop being invisible doublings and dashed tails stop fighting each other.
// Gradual tails are diagonal and stay on the span top; arcs have no tail.
// ---------------------------------------------------------------------------

export interface BoundaryTailInput {
  startTime: number
  endTime: number
  lineType?: LineType | null
  startBoundaryType?: BoundaryType | null
  endBoundaryType?: BoundaryType | null
  confidence?: ConfidenceLevel | null
}

export interface BoundaryTail {
  /** Boundary time (seconds). The renderer maps this to px and applies edge inset. */
  time: number
  /** Dashed if EITHER neighbour at this boundary is approximate/speculative. */
  dashed: boolean
  /** The extreme tails — inset inward by ½ stroke so they don't clip the canvas. */
  edge: 'start' | 'end' | null
}

function isDashedConfidence(c?: ConfidenceLevel | null): boolean {
  return c === 'approximate' || c === 'speculative'
}

/**
 * The shared vertical boundary tails for one layer's spans, sorted ascending and
 * collapsed within epsilon. A flat bracket with a definite/elided boundary
 * contributes a tail; gradual boundaries and arcs do not. A collapsed tail is
 * dashed if ANY contributing span is approximate/speculative (the shared-boundary
 * confidence rule). The first and last tails are flagged as edges.
 */
export function boundaryTails(spans: BoundaryTailInput[]): BoundaryTail[] {
  const events: { time: number; dashed: boolean }[] = []
  for (const s of spans) {
    if ((s.lineType ?? 'arc') !== 'flat') continue
    const dashed = isDashedConfidence(s.confidence)
    if ((s.startBoundaryType ?? 'definite') !== 'gradual') {
      events.push({ time: s.startTime, dashed })
    }
    if ((s.endBoundaryType ?? 'definite') !== 'gradual') {
      events.push({ time: s.endTime, dashed })
    }
  }
  events.sort((a, b) => a.time - b.time)

  const tails: BoundaryTail[] = []
  for (const e of events) {
    const last = tails[tails.length - 1]
    if (last && Math.abs(e.time - last.time) <= TIME_EPS) {
      last.dashed = last.dashed || e.dashed
    } else {
      tails.push({ time: e.time, dashed: e.dashed, edge: null })
    }
  }
  if (tails.length > 0) tails[0].edge = 'start'
  if (tails.length > 1) tails[tails.length - 1].edge = 'end'
  return tails
}

/** Foot of the corner / top of the shared vertical for a span of the given width. */
export function tailVerticalTopY(width: number, height: number = SHAPE_HEIGHT): number {
  return Math.min(CORNER_RADIUS, Math.max(width, 0) / 2, height)
}

// ---------------------------------------------------------------------------
// Confidence → stroke styling (Phase 0.7 §6.1)
// ---------------------------------------------------------------------------

export interface StrokeStyle {
  dash: string | undefined
  opacity: number
}

export function confidenceStroke(confidence?: ConfidenceLevel): StrokeStyle {
  switch (confidence) {
    case 'approximate':
      return { dash: '4 3', opacity: 1 }
    case 'speculative':
      return { dash: '4 3', opacity: 0.6 }
    case 'definite':
    default:
      return { dash: undefined, opacity: 1 }
  }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Parse a #rgb / #rrggbb string to [r,g,b] 0–255, or null if unparseable. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, '')
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16)
    const g = parseInt(m[1] + m[1], 16)
    const b = parseInt(m[2] + m[2], 16)
    return [r, g, b]
  }
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16)
    const g = parseInt(m.slice(2, 4), 16)
    const b = parseInt(m.slice(4, 6), 16)
    return [r, g, b]
  }
  return null
}

/** Relative luminance (WCAG-ish, simple sRGB) 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 1 // unknown → treat as light
  const [r, g, b] = rgb.map((c) => c / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Pick a legible text color for a label/annotation sitting ON a filled shape.
 * White fills (open brackets) → use the supplied ink color; dark fills → white.
 * Per spec §6 we never use plain black; the caller passes the ink ramp color.
 */
export function textOnFill(fill: string, ink: string): string {
  return luminance(fill) > 0.6 ? ink : '#ffffff'
}
