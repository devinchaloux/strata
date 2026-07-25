import { describe, it, expect } from 'vitest'
import {
  layoutMarkerBand,
  BAND_TOP_GAP,
  BAND_BOTTOM_GAP,
  BAND_ROW_HEIGHT,
  MAX_ROWS,
} from '@/lib/markerBand'
import type { PointMarker } from '@/types/strata'

function marker(id: string, timestamp: number, patch: Partial<PointMarker> = {}): PointMarker {
  return {
    id,
    timestamp,
    label: null,
    type: 'half-cadence',
    notes: null,
    flagged: false,
    confidence: 'definite',
    harmonicContext: null,
    ...patch,
  } as PointMarker
}

const PPS = 10

describe('layoutMarkerBand', () => {
  it('reserves no space with no markers', () => {
    const l = layoutMarkerBand([], [], PPS)
    expect(l.rows).toBe(0)
    expect(l.height).toBe(0)
    expect(l.placements).toEqual([])
  })

  it('reserves one row as soon as a marker exists', () => {
    const l = layoutMarkerBand([marker('a', 10)], [], PPS)
    expect(l.rows).toBe(1)
    expect(l.height).toBe(BAND_TOP_GAP + BAND_ROW_HEIGHT + BAND_BOTTOM_GAP)
  })

  it('places a lone marker on row 0', () => {
    const l = layoutMarkerBand([marker('a', 10)], [], PPS)
    expect(l.placements[0].row).toBe(0)
    expect(l.placements[0].caption).toBe('HC')
    expect(l.rows).toBe(1)
  })

  it('keeps well-separated markers on the same row', () => {
    const l = layoutMarkerBand([marker('a', 0), marker('b', 100)], [], PPS)
    expect(l.placements.map((p) => p.row)).toEqual([0, 0])
    expect(l.rows).toBe(1)
  })

  it('drops a colliding caption to the next row and grows the band', () => {
    const l = layoutMarkerBand([marker('a', 10), marker('b', 10.1)], [], PPS)
    expect(l.placements.map((p) => p.row)).toEqual([0, 1])
    expect(l.rows).toBe(2)
    expect(l.height).toBe(BAND_TOP_GAP + 2 * BAND_ROW_HEIGHT + BAND_BOTTOM_GAP)
  })

  it('sorts by time, so input order does not affect row assignment', () => {
    const late = marker('late', 10.1)
    const early = marker('early', 10)
    const l = layoutMarkerBand([late, early], [], PPS)
    expect(l.placements.map((p) => p.marker.id)).toEqual(['early', 'late'])
    expect(l.placements.map((p) => p.row)).toEqual([0, 1])
  })

  it('keeps the glyph but drops the caption once the row budget is exhausted', () => {
    const stacked = Array.from({ length: MAX_ROWS + 2 }, (_, i) =>
      marker(`m${i}`, 10 + i * 0.05),
    )
    const l = layoutMarkerBand(stacked, [], PPS)
    expect(l.rows).toBe(MAX_ROWS)

    const withCaption = l.placements.filter((p) => p.caption !== null)
    const without = l.placements.filter((p) => p.caption === null)
    expect(withCaption).toHaveLength(MAX_ROWS)
    expect(without).toHaveLength(2)
    // Every marker survives as a placement even when its caption does not.
    expect(l.placements).toHaveLength(MAX_ROWS + 2)
    expect(without.every((p) => p.style === 'glyph')).toBe(true)
  })

  it('boxes a cadence that has a caption', () => {
    const l = layoutMarkerBand([marker('a', 10, { kind: 'cadence' })], [], PPS)
    expect(l.placements[0].style).toBe('boxed')
  })

  it('falls back to a glyph for a cadence with nothing to caption', () => {
    const l = layoutMarkerBand(
      [marker('a', 10, { kind: 'cadence', type: null, harmonicContext: null })],
      [],
      PPS,
    )
    expect(l.placements[0].caption).toBeNull()
    expect(l.placements[0].style).toBe('glyph')
  })

  it('uses a glyph for non-cadence kinds even when captioned', () => {
    const l = layoutMarkerBand([marker('a', 10, { kind: 'flag' })], [], PPS)
    expect(l.placements[0].style).toBe('glyph')
    expect(l.placements[0].caption).toBe('HC')
  })

  it('marks an absent event as struck through', () => {
    const l = layoutMarkerBand(
      [marker('a', 10, { kind: 'cadence', absent: true }), marker('b', 100)],
      [],
      PPS,
    )
    expect(l.placements[0].struck).toBe(true)
    expect(l.placements[1].struck).toBe(false)
  })

  it('joins key and type in the caption', () => {
    const l = layoutMarkerBand(
      [marker('a', 10, { type: 'perfect-authentic-cadence', harmonicContext: 'V' })],
      [],
      PPS,
    )
    expect(l.placements[0].caption).toBe('V:PAC')
  })

  it('separates the same markers as zoom increases', () => {
    const pair = [marker('a', 10), marker('b', 10.6)]
    expect(layoutMarkerBand(pair, [], 2).rows).toBe(2)
    expect(layoutMarkerBand(pair, [], 400).rows).toBe(1)
  })
})
