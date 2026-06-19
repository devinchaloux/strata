// Pure timeline utilities — no React imports.

export const MIN_ZOOM = 1
export const MAX_ZOOM = 200

// Pixels between ticks before the interval steps up to the next nice value.
const MIN_PX_BETWEEN_TICKS = 64

// Nice tick intervals in seconds (ascending).
const TICK_INTERVALS = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
]

/**
 * Pixels per second given the current viewport width, zoom, and track duration.
 * Returns 0 when duration or viewportWidth are not yet known.
 *
 * Matches the ViewState pixel formula in uiStore:
 *   px = timestamp * pps - scrollOffset
 * where pps = (viewportWidth * zoom) / duration
 */
export function computePps(duration: number, viewportWidth: number, zoom: number): number {
  if (duration <= 0 || viewportWidth <= 0) return 0
  return (viewportWidth * zoom) / duration
}

/** Clamp scroll offset to the valid range [0, totalWidth - viewportWidth]. */
export function clampScrollOffset(
  offset: number,
  totalWidth: number,
  viewportWidth: number,
): number {
  return Math.max(0, Math.min(offset, Math.max(0, totalWidth - viewportWidth)))
}

/**
 * Choose the largest "nice" interval that keeps ticks at least
 * MIN_PX_BETWEEN_TICKS apart.
 */
export function getTickInterval(pps: number): number {
  if (pps <= 0) return 60
  const minInterval = MIN_PX_BETWEEN_TICKS / pps
  return TICK_INTERVALS.find((i) => i >= minInterval) ?? 600
}

/**
 * Format a timestamp as a tick label at the given interval's precision.
 * Uses integer arithmetic to avoid floating-point label artifacts.
 */
export function formatTickLabel(seconds: number, interval: number): string {
  // Snap to interval precision before formatting
  const snapped = Math.round(seconds / interval) * interval
  const totalMs = Math.round(snapped * 1000)
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const sec = totalSec % 60
  const min = Math.floor(totalSec / 60)

  const secStr = String(sec).padStart(2, '0')

  if (interval >= 1) {
    return `${min}:${secStr}`
  }
  if (interval >= 0.1) {
    const tenths = Math.round(ms / 100)
    return `${min}:${secStr}.${tenths}`
  }
  if (interval >= 0.01) {
    const hundredths = Math.round(ms / 10)
    return `${min}:${secStr}.${String(hundredths).padStart(2, '0')}`
  }
  return `${min}:${secStr}.${String(ms).padStart(3, '0')}`
}

export interface Tick {
  index: number   // integer index from track start (tick.time = index * interval)
  time: number    // seconds
  x: number       // pixel x in unscrolled absolute space (= time * pps)
  label: string
}

/**
 * Generate tick marks visible in the current viewport.
 * Only returns ticks within [scrollOffset, scrollOffset + viewportWidth].
 */
export function generateTicks(
  duration: number,
  pps: number,
  scrollOffset: number,
  viewportWidth: number,
): Tick[] {
  if (duration <= 0 || pps <= 0 || viewportWidth <= 0) return []

  const interval = getTickInterval(pps)
  const visibleStart = scrollOffset / pps
  const visibleEnd = Math.min(duration, (scrollOffset + viewportWidth) / pps)

  const firstIndex = Math.max(0, Math.floor(visibleStart / interval))
  // One tick beyond visible end to avoid a gap at the right edge while scrolling
  const lastIndex = Math.ceil(visibleEnd / interval) + 1

  const ticks: Tick[] = []
  for (let i = firstIndex; i <= lastIndex; i++) {
    const t = i * interval
    if (t > duration) break
    ticks.push({
      index: i,
      time: t,
      x: t * pps,
      label: formatTickLabel(t, interval),
    })
  }
  return ticks
}
