/**
 * Marker annotation band layout.
 *
 * Point markers render inside the form diagram, in a band below the layer
 * stack, so they are part of the exported graphic rather than editor chrome
 * (see docs/decisions.md, 2026-07-24).
 *
 * Captions collide constantly on a dense analysis — the "SoundCloud comments"
 * failure mode. The strategy is to **grow, never shrink**: a caption that
 * would overlap its neighbour drops to the next row and the band gets taller.
 * Only when the row budget is exhausted does a caption drop out entirely,
 * leaving its glyph behind. This follows the precedent set for span labels
 * (improvement-backlog #12): show the whole label or show a mark, never a
 * mangled stub.
 */

import { estimateTextWidth } from './formShape'
import { formatMarkerCaption } from './pointMarkerTypes'
import type { PointMarker, VocabTerm } from '@/types/strata'

export const BAND_TOP_GAP = 6
/**
 * Clearance below the last caption row. Without it a boxed cadence label sits
 * flush on the widget card's bottom border and reads as clipped.
 */
export const BAND_BOTTOM_GAP = 5
export const BAND_ROW_HEIGHT = 13
export const BAND_FONT_PX = 9
/** Half-width of the diamond glyph. */
export const GLYPH_HALF = 3.5
/** Gap between a glyph and the caption beside it. */
const CAPTION_PAD = 3
/** Minimum clear space between two captions sharing a row. */
const CAPTION_GUTTER = 6
/** Horizontal padding inside a boxed cadence label. */
export const BOX_PAD_X = 3
/**
 * Beyond this, extra rows cost more legibility (captions drift far from their
 * glyph) than the captions are worth. Surplus captions degrade to glyph-only.
 */
export const MAX_ROWS = 3

export type MarkerStyle = 'boxed' | 'glyph'

export interface MarkerPlacement {
  marker: PointMarker
  /** Content-space x of the marker's instant. */
  x: number
  /** Row index within the band; 0 is nearest the layer stack. */
  row: number
  /** Null when no caption is available, or when the row budget ran out. */
  caption: string | null
  style: MarkerStyle
  /** Evaded/expected-but-absent — drawn struck through. */
  struck: boolean
  /** Caption extent, for hit-testing and debugging. */
  left: number
  right: number
}

export interface MarkerBandLayout {
  placements: MarkerPlacement[]
  rows: number
  height: number
}

/**
 * A cadence reads as a boxed label in the conventional notation (the `CAD`,
 * `PAC`, `HC!` boxes in analytical graphics); everything else is an instant
 * marked with a glyph and annotated beside it. This is the visual job `kind`
 * does — the reason it stays a separate field from `type`.
 */
function styleFor(marker: PointMarker, caption: string | null): MarkerStyle {
  return marker.kind === 'cadence' && caption ? 'boxed' : 'glyph'
}

function extentFor(x: number, style: MarkerStyle, captionWidth: number): [number, number] {
  if (style === 'boxed') {
    const half = captionWidth / 2 + BOX_PAD_X
    return [x - half, x + half]
  }
  return [x - GLYPH_HALF, x + GLYPH_HALF + CAPTION_PAD + captionWidth]
}

/**
 * Pack markers into the band. Markers are processed in time order so the
 * greedy row assignment is stable: earlier markers keep row 0, later ones
 * step down only when they would collide.
 */
export function layoutMarkerBand(
  markers: PointMarker[],
  customTypes: VocabTerm[],
  pps: number,
): MarkerBandLayout {
  // A document with no markers reserves no space. Placement is still reachable
  // from the M key and the transport button, so an empty band would only cost
  // vertical room the diagram can use for something else.
  if (markers.length === 0) return { placements: [], rows: 0, height: 0 }

  const ordered = [...markers].sort((a, b) => a.timestamp - b.timestamp)
  const rowRightEdges: number[] = []
  const placements: MarkerPlacement[] = []

  for (const marker of ordered) {
    const x = marker.timestamp * pps
    const caption = formatMarkerCaption(marker, customTypes)
    const style = styleFor(marker, caption)
    const captionWidth = caption ? estimateTextWidth(caption, BAND_FONT_PX) : 0
    const [left, right] = extentFor(x, style, captionWidth)

    if (!caption) {
      placements.push({ marker, x, row: 0, caption: null, style, struck: false, left, right })
      continue
    }

    let row = -1
    for (let r = 0; r < MAX_ROWS; r++) {
      const occupiedTo = rowRightEdges[r]
      if (occupiedTo === undefined || left >= occupiedTo + CAPTION_GUTTER) {
        row = r
        break
      }
    }

    if (row === -1) {
      // Row budget exhausted: keep the marker, drop the caption.
      placements.push({
        marker,
        x,
        row: 0,
        caption: null,
        style: 'glyph',
        struck: false,
        left: x - GLYPH_HALF,
        right: x + GLYPH_HALF,
      })
      continue
    }

    rowRightEdges[row] = right
    placements.push({
      marker,
      x,
      row,
      caption,
      style,
      struck: marker.absent === true,
      left,
      right,
    })
  }

  const rows = Math.max(1, rowRightEdges.length)
  return {
    placements,
    rows,
    height: BAND_TOP_GAP + rows * BAND_ROW_HEIGHT + BAND_BOTTOM_GAP,
  }
}

/** Band height without laying out, for callers that only need the metric. */
export function markerBandHeight(
  markers: PointMarker[],
  customTypes: VocabTerm[],
  pps: number,
): number {
  return layoutMarkerBand(markers, customTypes, pps).height
}
