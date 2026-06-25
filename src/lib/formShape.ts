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

export const SHAPE_HEIGHT = 26 // uniform across all layers (the BriFormer cue)
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
