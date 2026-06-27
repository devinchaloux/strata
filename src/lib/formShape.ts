/**
 * Pure geometry + color helpers for form-diagram span shapes.
 *
 * No React, no DOM. Everything here is a pure function so it can be unit-tested
 * and reused by both the editor render path and (later) the embeddable viewer.
 *
 * Shape model (per docs/decisions.md "Form Diagram Shape Model", 2026-06-27):
 *   A span is ONE path — a flat-topped bracket. The top line is always flat
 *   (domes/arcs are retired). The two end caps carry the visual variety and are
 *   the analyst's explicit drawing choice (decoupled from analytical data):
 *     - rounded → flat top meeting a vertical tail through a rounded corner
 *     - square  → flat top meeting a vertical tail at a sharp corner
 *     - angled  → a diagonal tail (processual feel)
 *     - open    → no tail on that side; the flat top just ends
 *     - elision → a vertical tail; the renderer adds a lighter inner overlap line
 *
 * Spans are drawn as discrete ISLANDS: the shape is inset by `inset` px on each
 * side so adjacent spans never share boundary pixels (no double-stamping). Stored
 * timestamps stay exact; only the rendered geometry insets.
 *
 * Coordinate convention: every path is built in LOCAL space where the slot spans
 * x ∈ [0, width], the top edge is y = 0, and the baseline is y = H. The caller
 * translates the group to the span's pixel x and the layer's y.
 *
 * Why an open path that we still fill: SVG fills an open subpath as if closed
 * along a straight line back to the start. For our brackets that implicit close
 * runs along the baseline — so a white fill reads as an open bracket while a
 * colored fill reads as a solid block. One path, two idioms, no special-casing.
 */

import type { BoundaryType, CapStyle, LineStyle } from '@/types/strata'

// ---------------------------------------------------------------------------
// Metrics (starting values; tweakable once seen on real data)
// ---------------------------------------------------------------------------

export const SHAPE_HEIGHT = 28 // uniform across all layers (the BriFormer cue)
export const CORNER_RADIUS = 10 // rounded-cap corner curve — deliberately round vs square
export const ANGLE_INSET = 9 // horizontal run of an angled cap's diagonal tail
export const STROKE_WIDTH = 1.5
export const ISLAND_INSET = 1.5 // px inset per side → ~3px gap (2px read as a grey seam, 4px too wide)

/**
 * Vertical anatomy — flush stacking.
 *
 * Layers stack with only a hairline gap. A layer's label is NOT given its own
 * reserved row — it is drawn just above the shape, overhanging up into the open
 * interior (negative space) of the bracket above it.
 *
 *   LAYER_PITCH   vertical advance per layer = shape + hairline gap
 *   STACK_TOP_PAD headroom above the top layer for its label
 *   LABEL_RISE    how far a label baseline sits above its shape's top edge
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
// Font scale (layer-level fontScale enum)
// ---------------------------------------------------------------------------

export type FontScale = 'sm' | 'md' | 'lg'

export const FONT_SIZES: Record<FontScale, { label: number; annotation: number }> = {
  sm: { label: 9.5, annotation: 8.5 },
  md: { label: 11, annotation: 9 },
  lg: { label: 13, annotation: 11 },
}

// ---------------------------------------------------------------------------
// Shape style resolution (visual style ← analyst choice, with data fallback)
// ---------------------------------------------------------------------------

/**
 * Default visual cap derived from the analytical boundary type, for back-compat
 * with files authored before `startCap`/`endCap` existed. `square` has no data
 * analog — it is reachable only as an explicit visual choice.
 */
export function capFromBoundaryType(b?: BoundaryType | null): CapStyle {
  switch (b) {
    case 'gradual':
      return 'angled'
    case 'elided':
      return 'elision'
    case 'definite':
    default:
      return 'rounded'
  }
}

/** SVG dash array for a stroke style, or undefined for solid. */
export function lineStyleDash(style?: LineStyle | null): string | undefined {
  return style === 'dashed' ? '4 3' : undefined
}

// ---------------------------------------------------------------------------
// Path construction
// ---------------------------------------------------------------------------

export interface ShapePathOptions {
  /** Pixel width of the span's slot. The shape is drawn inset within it. */
  width: number
  height?: number
  startCap: CapStyle
  endCap: CapStyle
  /** Inset per side (px) — the island gap. Default 0 (tests / measuring). */
  inset?: number
}

/**
 * Build the SVG path `d` string for a span bracket in local coordinates.
 * Returns '' when the inset slot is too narrow to draw. The path is open (no
 * `Z`); fill closes it along the baseline.
 */
export function buildShapePath({
  width,
  height = SHAPE_HEIGHT,
  startCap,
  endCap,
  inset = 0,
}: ShapePathOptions): string {
  const H = height
  const L = inset
  const R = width - inset
  if (R <= L) return ''

  const span = R - L
  // Cap the corner radius at ~30% of the width so a real flat top always remains:
  // a full CORNER_RADIUS on a narrow (portrait) span would consume the whole top
  // and read as a dome/bubble, which is exactly what we retired.
  const r = Math.min(CORNER_RADIUS, span * 0.3, H)
  const aInset = Math.min(ANGLE_INSET, span / 2)

  const parts: string[] = []

  // --- Left cap ---
  if (startCap === 'rounded') {
    parts.push(`M ${L} ${H}`, `L ${L} ${r}`, `A ${r} ${r} 0 0 1 ${L + r} 0`)
  } else if (startCap === 'angled') {
    // "/" — bottom at the boundary, leaning up-and-right into the flat top
    parts.push(`M ${L} ${H}`, `L ${L + aInset} 0`)
  } else if (startCap === 'open') {
    parts.push(`M ${L} 0`)
  } else {
    // square, elision — a straight vertical tail
    parts.push(`M ${L} ${H}`, `L ${L} 0`)
  }

  // --- Top line ---
  const rightTopX = endCap === 'rounded' ? R - r : endCap === 'angled' ? R - aInset : R
  parts.push(`L ${rightTopX} 0`)

  // --- Right cap ---
  if (endCap === 'rounded') {
    parts.push(`A ${r} ${r} 0 0 1 ${R} ${r}`, `L ${R} ${H}`)
  } else if (endCap === 'angled') {
    // "\" — leaning down-and-right from the flat top to the boundary
    parts.push(`L ${R} ${H}`)
  } else if (endCap === 'open') {
    // no tail — the top simply ends
  } else {
    // square, elision
    parts.push(`L ${R} ${H}`)
  }

  return parts.join(' ')
}

/**
 * The lighter inner overlap line for an `elision` cap: a short vertical drawn
 * just inside the cap's tail. Returns null for non-elision caps. `side` selects
 * which end. Local coords; same `inset` convention as buildShapePath.
 */
export function elisionInnerLine(
  cap: CapStyle,
  side: 'start' | 'end',
  width: number,
  height: number = SHAPE_HEIGHT,
  inset = 0,
): string | null {
  if (cap !== 'elision') return null
  const offset = 3
  const x = side === 'start' ? inset + offset : width - inset - offset
  if (x <= inset || x >= width - inset) return null
  return `M ${x} ${height} L ${x} ${Math.min(CORNER_RADIUS, height)}`
}

// ---------------------------------------------------------------------------
// Text fitting (collision strategy: abbreviation)
//
// Text placed INSIDE a shape body must respect the shape bounds, so it is
// truncated with an ellipsis. Width is estimated, not measured, so this stays a
// pure function: a slightly conservative average advance keeps truncation from
// overflowing. Above-shape labels live in negative space and are left intact.
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
