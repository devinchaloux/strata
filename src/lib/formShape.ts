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
 *     - elision → the SAME rounded corner, drawn displaced OUTWARD past the
 *                 boundary so the bracket reaches into its neighbour
 *
 * Spans are drawn as discrete ISLANDS: the shape is inset by `inset` px on each
 * side so adjacent spans never share boundary pixels (no double-stamping). Stored
 * timestamps stay exact; only the rendered geometry insets.
 *
 * The elision cap is the one deliberate exception to that inset: instead of
 * pulling in, it pushes out. An elision is the analyst's claim that two sections
 * meld rather than cut cleanly, so the drawn boundary leaves the timepoint and
 * overlaps the neighbour. The stored time never moves — same timepoint, different
 * ink. It is per-boundary, not reciprocal: one layer can elide where the layer
 * below does not, which is what makes the difference legible down the stack.
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

import type { BoundaryType, CapStyle, LineStyle, Layer } from '@/types/strata'

// ---------------------------------------------------------------------------
// Metrics (starting values; tweakable once seen on real data)
// ---------------------------------------------------------------------------

export const SHAPE_HEIGHT = 28 // bracket layers (the BriFormer cue)
// Key-area ("bar") layers: a thin flat rect, not a bracket — the shape doesn't
// need the full bracket height (docs/decisions.md "Key-Area Bar Layers").
export const BAR_HEIGHT = 10
// Rounded-cap corner curve — deliberately round vs square. Raised 10 → 20 on
// 2026-07-25: CORNER_MAX_RATIO already stops a narrow span from curving into a
// bubble, so the base value only has to serve spans wide enough to carry it.
// Below ~67px wide the ratio governs and this value never applies.
export const CORNER_RADIUS = 20
export const ANGLE_INSET = 9 // horizontal run of an angled cap's diagonal tail
export const STROKE_WIDTH = 1.5
export const ISLAND_INSET = 1.5 // px inset per side → ~3px gap (2px read as a grey seam, 4px too wide)
// How far an `elision` cap pushes PAST the boundary, into the neighbour. A fixed
// pixel amount, not derived from the data: an elision signals that something
// overlaps here, it does not measure how much. Zoom-invariant for the same reason.
export const ELISION_EXTEND = 8
// ...but never more than half the span's own width, so a very narrow span can't
// fling its tail clean past its neighbour and land somewhere meaningless. Below
// ~16px the extension scales down with the span instead of staying fixed.
export const ELISION_EXTEND_MAX_RATIO = 0.5
// Max share of a span's width that ONE corner curve may consume. Two corners at
// this ratio leave (1 - 2r) of flat top; at 0.5 they meet and the flat top is
// gone, which is the dome the Adjoin Rework retired.
export const CORNER_MAX_RATIO = 0.3

/**
 * Vertical anatomy — flush stacking.
 *
 * Layers stack with only a hairline gap. A layer's label is NOT given its own
 * reserved row — it is drawn just above the shape, overhanging up into the open
 * interior (negative space) of the bracket above it.
 *
 *   LAYER_PITCH   vertical advance for a bracket-shape layer = shape + hairline gap
 *   STACK_TOP_PAD headroom above the top layer for its label
 *   LABEL_RISE    how far a label baseline sits above its shape's top edge
 *
 * Bar-shape (key-area) layers are thinner, so the stack is no longer uniform
 * per-layer height — layerBodyHeight/layerPitch resolve each layer's own
 * height from its spanShape; stackHeight/shapeTopY sum across the actual list.
 */
export const LAYER_GAP = 3
export const LAYER_PITCH = SHAPE_HEIGHT + LAYER_GAP
export const STACK_TOP_PAD = 18
export const LABEL_RISE = 4

/** A layer's shape body height, resolved from its spanShape (bracket = default). */
export function layerBodyHeight(layer: Layer): number {
  return layer.spanShape === 'bar' ? BAR_HEIGHT : SHAPE_HEIGHT
}

/** A layer's vertical advance in the stack = its body height + the hairline gap. */
export function layerPitch(layer: Layer): number {
  return layerBodyHeight(layer) + LAYER_GAP
}

/** Total pixel height of a flush stack of the given (visible) layers. */
export function stackHeight(layers: Layer[]): number {
  return STACK_TOP_PAD + layers.reduce((sum, l) => sum + layerPitch(l), 0)
}

/** Top-edge y of the shape for layer index i (0 = top of the stack). */
export function shapeTopY(layers: Layer[], i: number): number {
  let y = STACK_TOP_PAD
  for (let j = 0; j < i; j++) y += layerPitch(layers[j])
  return y
}

/** Which layer index a given y (container-local, px) falls within. Clamps to
 *  the valid range; returns 0 for an empty layer list. */
export function layerIndexAtY(layers: Layer[], y: number): number {
  if (layers.length === 0) return 0
  let acc = STACK_TOP_PAD
  for (let i = 0; i < layers.length; i++) {
    acc += layerPitch(layers[i])
    if (y < acc) return i
  }
  return layers.length - 1
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
  /** Corner curve for rounded/elision caps. Defaults to CORNER_RADIUS.
   *  Overridable so the shape lab can vary it live (see uiStore.shapeLab). */
  cornerRadius?: number
  /** How far an elision cap pushes past the boundary. Defaults to ELISION_EXTEND. */
  elisionExtend?: number
  /** Max fraction of the span's width one corner may consume. Defaults to
   *  CORNER_MAX_RATIO. Raising it toward 0.5 makes the two corners meet and the
   *  flat top disappear (a dome). Overridable for the shape lab. */
  cornerRatio?: number
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
  cornerRadius = CORNER_RADIUS,
  elisionExtend = ELISION_EXTEND,
  cornerRatio = CORNER_MAX_RATIO,
}: ShapePathOptions): string {
  const H = height
  // An elision cap pushes outward past the boundary instead of insetting inward,
  // so the bracket overlaps its neighbour. Everything downstream is unchanged —
  // the cap draws its ordinary shape, just at a displaced x.
  const ext = Math.min(elisionExtend, width * ELISION_EXTEND_MAX_RATIO)
  const L = inset - (startCap === 'elision' ? ext : 0)
  const R = width - inset + (endCap === 'elision' ? ext : 0)
  if (R <= L) return ''

  const span = R - L
  // Cap the corner radius at ~30% of the width so a real flat top always remains:
  // a full cornerRadius on a narrow (portrait) span would consume the whole top
  // and read as a dome/bubble, which is exactly what we retired.
  const r = Math.min(cornerRadius, span * cornerRatio, H)
  const aInset = Math.min(ANGLE_INSET, span / 2)

  const parts: string[] = []

  // `elision` draws the ordinary rounded corner — only its x is displaced (above).
  const startRounded = startCap === 'rounded' || startCap === 'elision'
  const endRounded = endCap === 'rounded' || endCap === 'elision'

  // --- Left cap ---
  if (startRounded) {
    parts.push(`M ${L} ${H}`, `L ${L} ${r}`, `A ${r} ${r} 0 0 1 ${L + r} 0`)
  } else if (startCap === 'angled') {
    // "/" — bottom at the boundary, leaning up-and-right into the flat top
    parts.push(`M ${L} ${H}`, `L ${L + aInset} 0`)
  } else if (startCap === 'open') {
    parts.push(`M ${L} 0`)
  } else {
    // square — a straight vertical tail
    parts.push(`M ${L} ${H}`, `L ${L} 0`)
  }

  // --- Top line ---
  const rightTopX = endRounded ? R - r : endCap === 'angled' ? R - aInset : R
  parts.push(`L ${rightTopX} 0`)

  // --- Right cap ---
  if (endRounded) {
    parts.push(`A ${r} ${r} 0 0 1 ${R} ${r}`, `L ${R} ${H}`)
  } else if (endCap === 'angled') {
    // "\" — leaning down-and-right from the flat top to the boundary
    parts.push(`L ${R} ${H}`)
  } else if (endCap === 'open') {
    // no tail — the top simply ends
  } else {
    // square
    parts.push(`L ${R} ${H}`)
  }

  return parts.join(' ')
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

// Below this many pixels, a truncated stub ("Dr…", "Ver…") isn't worth
// showing — it reads as clutter rather than information at extreme zoom-out,
// and the full label is always one hover/click away (tooltip, metadata
// panel). Whole labels that already fit are unaffected by this floor — it
// only gates the truncation path. (improvement-backlog #12.)
const MIN_STUB_WIDTH_PX = 26

/** Rough pixel width of `text` at `fontPx`. Estimate, not a measurement. */
export function estimateTextWidth(text: string, fontPx: number): number {
  return text.length * fontPx * AVG_CHAR_ADVANCE
}

/**
 * Truncate `text` so it fits within `maxWidthPx` at `fontPx`, appending an
 * ellipsis when shortened. Returns '' when not even one character plus the
 * ellipsis fits, or when the available lane is below MIN_STUB_WIDTH_PX (the
 * caller then renders nothing — full text remains available in the metadata
 * panel and the span's title tooltip).
 */
export function truncateToWidth(text: string, fontPx: number, maxWidthPx: number): string {
  if (!text) return ''
  if (maxWidthPx <= 0) return ''
  if (estimateTextWidth(text, fontPx) <= maxWidthPx) return text
  if (maxWidthPx < MIN_STUB_WIDTH_PX) return ''
  const ellipsisW = estimateTextWidth(ELLIPSIS, fontPx)
  // Largest prefix whose width + ellipsis still fits.
  let n = 0
  while (
    n < text.length &&
    estimateTextWidth(text.slice(0, n + 1), fontPx) + ellipsisW <= maxWidthPx
  ) {
    n++
  }
  return n <= 1 ? '' : text.slice(0, n).trimEnd() + ELLIPSIS
}

// ---------------------------------------------------------------------------
// Above-label layout (neighbour-aware whole-label-or-marker — §7 collision
// strategy, revised 2026-07-03 per improvement-backlog #12)
//
// Above-shape labels live in "negative space": each is drawn just above its span,
// overhanging up into the open interior of the layer above. Within a layer, all
// labels share one horizontal band, so a label wider than its span overhangs
// SIDEWAYS into its neighbours' labels (the `Beat-match intr·Intro` collision).
//
// The fix is a single left-to-right layout pass per layer. Each label gets a
// horizontal "lane" bounded by the midpoints to its neighbours' centers (never
// tighter than the span's own footprint — see the leftBound/rightBound clamps
// below); a centered label may grow until it reaches a neighbour's half of that
// midpoint. Where there is room the label stays whole.
//
// Unlike inside-shape text, above-labels are NEVER algorithmically truncated
// with an ellipsis — a machine-chopped "Dr…"/"Ver…" stub reads as clutter, not
// information, at extreme zoom-out. Instead: show the full label if it fits,
// else the analyst-authored `shortLabel` if it fits (shown whole, never itself
// abbreviated further), else nothing — with `hidden: true` on the result so the
// renderer can draw a small marker indicating a label exists but has no room.
// Full text always survives in the tooltip and the metadata panel.
//
// We deliberately do NOT stagger labels vertically: the flush stack leaves almost
// no vertical room (a label sits in the shallow void of the layer above), so the
// horizontal axis is the only safe place to give. Truncation is also deterministic
// and reuses estimateTextWidth/truncateToWidth, keeping the whole pass pure.
// ---------------------------------------------------------------------------

export type Justification = 'left' | 'center' | 'right'

export const ANCHOR: Record<Justification, 'start' | 'middle' | 'end'> = {
  left: 'start',
  center: 'middle',
  right: 'end',
}

/** Horizontal inset for left/right-justified text from the span edge. */
export const TEXT_PAD = 5

/**
 * Per-side clear space pulled inward from a shared lane midpoint, so neighbouring
 * labels never touch. Two adjacent labels each inset by this much → ~2× this many
 * px of gap between them. It also absorbs the gap between estimated and rendered
 * text width (the ellipsis glyph runs a touch wider than the average advance), so
 * a heavily-truncated `Bu…` beside another `Bu…` stays clearly separated.
 */
export const LABEL_GUTTER = 4

/** Local x of a label's anchor point given its justification. */
export function textX(spanX: number, width: number, just: Justification): number {
  if (just === 'center') return spanX + width / 2
  if (just === 'right') return spanX + width - TEXT_PAD
  return spanX + TEXT_PAD
}

/**
 * Re-anchor an above-label so it never bleeds past a timeline edge. A centered
 * label on the first/last span overhangs into the header column (left) or off the
 * track end (right); re-anchoring it to that edge keeps the whole label readable
 * with no clip. Interior labels are unaffected. Returns the resolved justification.
 */
export function edgeAwareJustification(
  just: Justification,
  textWidth: number,
  spanX: number,
  spanWidth: number,
  totalWidth: number,
): Justification {
  const localX = textX(0, spanWidth, just)
  const anchor = ANCHOR[just]
  const absLeft =
    anchor === 'start'
      ? spanX + localX
      : anchor === 'middle'
        ? spanX + localX - textWidth / 2
        : spanX + localX - textWidth
  if (absLeft < 0) return 'left'
  if (absLeft + textWidth > totalWidth) return 'right'
  return just
}

export interface SpanLabelInput {
  id: string
  /** Left edge of the span, in px. */
  x: number
  /** Span width, in px. */
  width: number
  /** Full label text (untruncated). */
  label: string
  /** Analyst-authored abbreviation, tried when the full label doesn't fit. */
  shortLabel?: string | null
}

export interface ResolvedLabel {
  /** Label or shortLabel, always shown whole ('' → render nothing). */
  text: string
  /** Justification after edge re-anchoring. */
  justification: Justification
  /** True when a label exists but neither it nor shortLabel fit the lane —
   *  the renderer draws a small marker instead of leaving a silent gap. */
  hidden: boolean
}

/**
 * Lay out one layer's above-shape labels so adjacent labels don't collide.
 *
 * Returns a map from span id to its resolved {text, justification, hidden}. The
 * spans may arrive in any order; neighbour relationships are computed from
 * on-screen x.
 *
 * Budget model: a label's lane is bounded by the midpoints between its own span
 * center and its neighbours' centers (clamped to the track), pulled in by
 * LABEL_GUTTER on each neighbour side. Two centered labels can never overlap —
 * each stays on its side of the shared midpoint, with the gutter keeping a clear
 * gap between them.
 */
export function layoutLayerLabels(
  spans: SpanLabelInput[],
  fontPx: number,
  totalWidth: number,
  baseJust: Justification,
): Map<string, ResolvedLabel> {
  const result = new Map<string, ResolvedLabel>()
  const ordered = [...spans].sort((a, b) => a.x - b.x)
  const centers = ordered.map((s) => s.x + s.width / 2)

  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i]
    if (!s.label) {
      result.set(s.id, { text: '', justification: baseJust, hidden: false })
      continue
    }

    // Lane edges: midpoint to each neighbour's center, pulled in by the gutter so
    // adjacent labels keep clear of one another. Track edges (no neighbour) get the
    // full extent — nothing to collide with there.
    //
    // Floored to the span's OWN footprint (min/max against its own edge) so an
    // abnormally narrow neighbour can never shrink a lane below what the span
    // already owns. The center-midpoint alone conflates "neighbour is narrow"
    // with "neighbour needs less room" — a half-width neighbour (e.g. a short
    // "Break" span) pulls the midpoint inside THIS span's own boundary, evicting
    // an otherwise-fitting single-letter label for no visual-collision reason
    // (the narrow neighbour's own label was never going to reach that far
    // anyway). The midpoint can still GRANT extra room by extending past the
    // span's own edge when a neighbour is wider — that borrowing behavior is
    // unchanged; this only stops it taking room away.
    const leftBound =
      i > 0
        ? Math.min((centers[i - 1] + centers[i]) / 2 + LABEL_GUTTER, s.x + LABEL_GUTTER)
        : 0
    const rightBound =
      i < ordered.length - 1
        ? Math.max(
            (centers[i] + centers[i + 1]) / 2 - LABEL_GUTTER,
            s.x + s.width - LABEL_GUTTER,
          )
        : totalWidth

    // Decide justification first (edge re-anchoring uses the full text width), then
    // measure how much horizontal room that anchor actually has inside the lane.
    const just = edgeAwareJustification(
      baseJust,
      estimateTextWidth(s.label, fontPx),
      s.x,
      s.width,
      totalWidth,
    )
    const anchorX = textX(s.x, s.width, just)
    const availW =
      just === 'center'
        ? 2 * Math.min(anchorX - leftBound, rightBound - anchorX)
        : just === 'left'
          ? rightBound - anchorX
          : anchorX - leftBound

    // Whole label, else whole shortLabel, else nothing — never an
    // algorithmic ellipsis stub (see the header comment above).
    let text = ''
    if (availW > 0 && estimateTextWidth(s.label, fontPx) <= availW) {
      text = s.label
    } else if (s.shortLabel && estimateTextWidth(s.shortLabel, fontPx) <= availW) {
      text = s.shortLabel
    }

    result.set(s.id, {
      text,
      justification: just,
      hidden: text === '',
    })
  }
  return result
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
