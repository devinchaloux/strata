// Pure timeline utilities — no React imports.

/**
 * Pixels per second at 100% zoom (zoom = 1.0). This is the *standard scale* —
 * deliberately decoupled from viewport width and track duration so that "100%"
 * means the same physical scale on every screen and every track. "Fit to window"
 * is now a separate, computed zoom (see computeFitZoom), not the meaning of 100%.
 *
 * Chosen so a typical 3–5 minute track reads at a comfortable working width with
 * legible boundary labels. Tune freely — it's the one lever for "how big is 100%".
 */
export const BASE_PPS = 10

// Absolute zoom bounds. zoom = 1.0 → 100% → BASE_PPS px/s.
//   ABS_MIN_ZOOM (5%):   floor for fitting very long tracks into the viewport.
//   ABS_MAX_ZOOM (5000%): ceiling for frame-level boundary editing.
export const ABS_MIN_ZOOM = 0.05
export const ABS_MAX_ZOOM = 50

// Pixels between ticks before the interval steps up to the next nice value.
const MIN_PX_BETWEEN_TICKS = 64

// Nice tick intervals in seconds (ascending).
const TICK_INTERVALS = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600,
]

/**
 * Pixels per second at the given zoom. Independent of viewport and duration:
 *   pps = BASE_PPS * zoom
 *
 * Matches the ViewState pixel formula in uiStore:
 *   px = timestamp * pps - scrollOffset
 */
export function computePps(zoom: number): number {
  return BASE_PPS * Math.max(zoom, 0)
}

/** Full pixel width of the track content at the given zoom. */
export function totalContentWidth(duration: number, zoom: number): number {
  return Math.max(0, duration * computePps(zoom))
}

/**
 * The zoom at which the whole track exactly fills the viewport. Returns 1 when
 * inputs aren't known yet so callers have a safe fallback.
 */
export function computeFitZoom(duration: number, viewportWidth: number): number {
  if (duration <= 0 || viewportWidth <= 0) return 1
  return viewportWidth / (duration * BASE_PPS)
}

/**
 * Smallest sensible zoom for the current track + viewport:
 *   - never zoom out past "the whole track fits" (no point — only dead space),
 *   - but never below 100% for short tracks (fit there is > 100%; zooming out
 *     further just shrinks a track that already fits, adding dead space).
 * Clamped to the absolute floor for pathologically long tracks.
 */
export function minZoom(duration: number, viewportWidth: number): number {
  const fit = computeFitZoom(duration, viewportWidth)
  return Math.max(ABS_MIN_ZOOM, Math.min(fit, 1))
}

/** Clamp a desired zoom into [minZoom, ABS_MAX_ZOOM] for this track + viewport. */
export function clampZoom(zoom: number, duration: number, viewportWidth: number): number {
  return Math.max(minZoom(duration, viewportWidth), Math.min(ABS_MAX_ZOOM, zoom))
}

// ---------------------------------------------------------------------------
// Scrollbar geometry — pure, so the draggable thumb math is unit-testable.
// The scrollbar track spans the content column (width = viewportWidth).
// ---------------------------------------------------------------------------

/** Minimum thumb width so it stays grabbable when very zoomed in. */
export const MIN_THUMB_PX = 28

export interface ScrollbarMetrics {
  /** False when the content fits — the caller renders nothing. */
  visible: boolean
  thumbWidth: number
  thumbX: number
  /** Max thumb left position (track width − thumb width). */
  maxThumbX: number
  /** Max scrollOffset (totalWidth − viewportWidth). */
  maxScroll: number
}

export function scrollbarMetrics(
  totalWidth: number,
  viewportWidth: number,
  scrollOffset: number,
): ScrollbarMetrics {
  // `!(x > 0)` rather than `x <= 0` so NaN inputs (possible on a transient render
  // before the viewport is measured) resolve to "hidden" instead of a NaN thumb.
  if (!(viewportWidth > 0) || !(totalWidth > viewportWidth)) {
    return { visible: false, thumbWidth: 0, thumbX: 0, maxThumbX: 0, maxScroll: 0 }
  }
  const thumbWidth = Math.max(MIN_THUMB_PX, (viewportWidth / totalWidth) * viewportWidth)
  const maxThumbX = viewportWidth - thumbWidth
  const maxScroll = totalWidth - viewportWidth
  const thumbX = maxScroll > 0 ? (scrollOffset / maxScroll) * maxThumbX : 0
  return { visible: true, thumbWidth, thumbX, maxThumbX, maxScroll }
}

/** Inverse of thumbX: map a thumb left position back to a clamped scrollOffset. */
export function scrollOffsetFromThumbX(
  thumbX: number,
  maxThumbX: number,
  maxScroll: number,
): number {
  if (maxThumbX <= 0) return 0
  return Math.max(0, Math.min(maxScroll, (thumbX / maxThumbX) * maxScroll))
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
