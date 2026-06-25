import { describe, it, expect } from 'vitest'
import {
  BASE_PPS,
  ABS_MIN_ZOOM,
  ABS_MAX_ZOOM,
  MIN_THUMB_PX,
  computePps,
  totalContentWidth,
  computeFitZoom,
  minZoom,
  clampZoom,
  clampScrollOffset,
  scrollbarMetrics,
  scrollOffsetFromThumbX,
} from '@/lib/timeline'

describe('computePps', () => {
  it('100% is the fixed BASE_PPS, independent of viewport/duration', () => {
    expect(computePps(1)).toBe(BASE_PPS)
    expect(computePps(2)).toBe(BASE_PPS * 2)
    expect(computePps(0.5)).toBe(BASE_PPS / 2)
  })

  it('never returns negative for a negative zoom', () => {
    expect(computePps(-3)).toBe(0)
  })
})

describe('totalContentWidth', () => {
  it('is duration * pps', () => {
    expect(totalContentWidth(100, 1)).toBe(100 * BASE_PPS)
    expect(totalContentWidth(100, 2)).toBe(200 * BASE_PPS)
  })
})

describe('computeFitZoom', () => {
  it('is the zoom that makes the track exactly fill the viewport', () => {
    // 240s track, 1200px viewport → totalWidth at fit must equal viewport
    const fit = computeFitZoom(240, 1200)
    expect(totalContentWidth(240, fit)).toBeCloseTo(1200)
  })

  it('long track on a narrow viewport fits below 100%', () => {
    expect(computeFitZoom(600, 800)).toBeLessThan(1)
  })

  it('short track on a wide viewport fits above 100%', () => {
    expect(computeFitZoom(30, 1200)).toBeGreaterThan(1)
  })

  it('falls back to 1 before inputs are known', () => {
    expect(computeFitZoom(0, 1000)).toBe(1)
    expect(computeFitZoom(240, 0)).toBe(1)
  })
})

describe('minZoom', () => {
  it('long track: min is fit (can zoom out to show whole track, no further)', () => {
    const fit = computeFitZoom(600, 800) // < 1
    expect(minZoom(600, 800)).toBeCloseTo(fit)
  })

  it('short track: min is 100% (fit is > 100%, reached by zooming in)', () => {
    // fit for a 30s track on 1200px is > 1, so min clamps to 1
    expect(minZoom(30, 1200)).toBe(1)
  })

  it('never below the absolute floor', () => {
    expect(minZoom(100000, 300)).toBe(ABS_MIN_ZOOM)
  })
})

describe('clampZoom', () => {
  it('clamps to [minZoom, ABS_MAX_ZOOM]', () => {
    expect(clampZoom(1000, 240, 1200)).toBe(ABS_MAX_ZOOM)
    const min = minZoom(600, 800)
    expect(clampZoom(0.0001, 600, 800)).toBeCloseTo(min)
  })

  it('passes a valid zoom through untouched', () => {
    expect(clampZoom(3, 240, 1200)).toBe(3)
  })
})

describe('scrollbarMetrics', () => {
  it('is hidden when content fits the viewport', () => {
    expect(scrollbarMetrics(800, 1000, 0).visible).toBe(false)
    expect(scrollbarMetrics(1000, 1000, 0).visible).toBe(false)
  })

  it('thumb is proportional to the visible fraction', () => {
    // viewport is half the content → thumb is half the track
    const m = scrollbarMetrics(2000, 1000, 0)
    expect(m.visible).toBe(true)
    expect(m.thumbWidth).toBeCloseTo(500)
    expect(m.maxScroll).toBe(1000)
    expect(m.maxThumbX).toBeCloseTo(500)
  })

  it('thumb reaches the right edge at max scroll', () => {
    const m = scrollbarMetrics(2000, 1000, 1000)
    expect(m.thumbX).toBeCloseTo(m.maxThumbX)
  })

  it('enforces a minimum thumb width when very zoomed in', () => {
    const m = scrollbarMetrics(100000, 1000, 0)
    expect(m.thumbWidth).toBe(MIN_THUMB_PX)
  })
})

describe('scrollOffsetFromThumbX', () => {
  it('inverts thumbX back to scrollOffset', () => {
    const m = scrollbarMetrics(2000, 1000, 0)
    // half-way along the thumb track → half of maxScroll
    expect(scrollOffsetFromThumbX(m.maxThumbX / 2, m.maxThumbX, m.maxScroll)).toBeCloseTo(500)
  })

  it('clamps to [0, maxScroll]', () => {
    expect(scrollOffsetFromThumbX(-50, 500, 1000)).toBe(0)
    expect(scrollOffsetFromThumbX(99999, 500, 1000)).toBe(1000)
  })

  it('returns 0 when there is no room to drag', () => {
    expect(scrollOffsetFromThumbX(10, 0, 0)).toBe(0)
  })
})

describe('clampScrollOffset', () => {
  it('clamps into [0, totalWidth - viewportWidth]', () => {
    expect(clampScrollOffset(-10, 2000, 1000)).toBe(0)
    expect(clampScrollOffset(5000, 2000, 1000)).toBe(1000)
    expect(clampScrollOffset(400, 2000, 1000)).toBe(400)
  })
})

describe('zoom bounds sanity', () => {
  it('absolute bounds bracket 100%', () => {
    expect(ABS_MIN_ZOOM).toBeLessThan(1)
    expect(ABS_MAX_ZOOM).toBeGreaterThan(1)
  })
})
