import { Playhead } from './Playhead'
import { useUIStore } from '@/store/uiStore'
import { generateTicks } from '@/lib/timeline'
import { gridLines, segmentEnd, sortedSegments, barLength } from '@/lib/beatGrid'
import type { GridSegment } from '@/types/strata'
import { TimelineScrollbar } from './TimelineScrollbar'

const RULER_HEIGHT = 24  // px — condensed ruler (the timeline reads tighter now)
const TICK_HEIGHT = 7    // px — tick line length at bottom of ruler
const LABEL_Y = 11       // px — text baseline from top of SVG
const BAR_STRIP = 12     // px — bar-number strip above the time labels, when there's a beat grid

export interface TimelineAxisProps {
  containerRef: React.RefObject<HTMLDivElement>
  pps: number
  totalWidth: number
  scrollOffset: number
  viewportWidth: number
  duration: number
  setScrollOffset: (offset: number) => void
  /** The document's beat grid, if any: adds a strip of bar numbers. */
  grid?: GridSegment[]
}

// Presentational ruler. The timeline state lives in useTimeline, lifted to
// FormDiagram so the zoom controls can render in the widget top bar (off the
// time labels) — the ruler just draws ticks, cursor, and the scrollbar.
//
// Point markers used to live in a lane above the ticks. They now render inside
// the form diagram (FormLayers) so they belong to the exported graphic rather
// than the editor chrome — see docs/decisions.md, 2026-07-24.
export function TimelineAxis({
  containerRef,
  pps,
  totalWidth,
  scrollOffset,
  viewportWidth,
  duration,
  setScrollOffset,
  grid,
}: TimelineAxisProps) {
  const ticks = generateTicks(duration, pps, scrollOffset, viewportWidth)

  // Bar numbers ride in their own strip above the time labels. Segments show as
  // a light band, so a free stretch reads as a gap; numbers thin out (every
  // 2nd, 4th… bar) when bars are narrow.
  const segs = sortedSegments(grid)
  const strip = segs.length > 0 && pps > 0 ? BAR_STRIP : 0
  const height = RULER_HEIGHT + strip
  let barEvery = 1
  if (strip) {
    const minBarPx = Math.min(...segs.map(barLength)) * pps
    while (minBarPx * barEvery < 26) barEvery *= 2
  }
  const barLabels = strip
    ? gridLines(segs, duration, 0, duration).filter((l) => l.bar !== null && (l.bar - 1) % barEvery === 0)
    : []


  // Width of SVG content — at minimum fill the viewport
  const svgWidth = Math.max(totalWidth, viewportWidth)

  const hasDocument = duration > 0

  return (
    <div
      className="shrink-0 border-b select-none"
      style={{ borderColor: 'hsl(var(--border))' }}
    >
      {/* Clicking the ruler moves the playhead there: the quickest way to get
          around without reaching for the video's own controls. */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height, cursor: hasDocument ? 'pointer' : undefined }}
        title={hasDocument ? 'Click to move the playhead here' : undefined}
        onClick={(e) => {
          if (!hasDocument || pps <= 0) return
          const rect = e.currentTarget.getBoundingClientRect()
          const t = (scrollOffset + e.clientX - rect.left) / pps
          useUIStore.getState().requestSeek(Math.max(0, Math.min(duration, t)))
        }}
      >
        {hasDocument ? (
          <>
            {/* SVG ruler — shifted left by scrollOffset to pan the content */}
            <svg
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: -scrollOffset,
                width: svgWidth,
                height,
                display: 'block',
              }}
            >
              {/* Ruler background */}
              <rect
                x={0}
                y={0}
                width={svgWidth}
                height={height}
                fill="hsl(var(--background))"
              />

              {/* Bar-number strip: segment bands, then bar numbers */}
              {strip > 0 &&
                segs.map((g, i) => (
                  <rect
                    key={g.id}
                    x={g.start * pps}
                    y={0}
                    width={(segmentEnd(segs, i, duration) - g.start) * pps}
                    height={strip}
                    fill="hsl(var(--muted))"
                  />
                ))}
              {barLabels.map((l) => (
                <text
                  key={l.time}
                  x={l.time * pps + 2}
                  y={10}
                  fill="hsl(var(--muted-foreground))"
                  fontSize={10}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {l.bar}
                </text>
              ))}

              {/* Tick marks + labels */}
              {ticks.map((tick) => (
                <g key={tick.index} transform={`translate(${tick.x}, ${strip})`}>
                  <line
                    x1={0}
                    y1={RULER_HEIGHT - TICK_HEIGHT}
                    x2={0}
                    y2={RULER_HEIGHT}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={3}
                    y={LABEL_Y}
                    fill="hsl(var(--muted-foreground))"
                    fontSize={10.5}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                    dominantBaseline="auto"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Track-end marker */}
              {pps > 0 && (
                <line
                  x1={duration * pps}
                  y1={0}
                  x2={duration * pps}
                  y2={height}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* Playback cursor — its own component, so only it redraws per frame */}
            <Playhead height={height} />
          </>
        ) : (
          /* No-document placeholder */
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'hsl(var(--muted))',
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* Horizontal scrollbar — only rendered when the content overflows */}
      <TimelineScrollbar
        totalWidth={totalWidth}
        viewportWidth={viewportWidth}
        scrollOffset={scrollOffset}
        onScroll={setScrollOffset}
      />
    </div>
  )
}
