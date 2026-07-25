import { generateTicks } from '@/lib/timeline'
import { TimelineScrollbar } from './TimelineScrollbar'

const RULER_HEIGHT = 24  // px — condensed ruler (the timeline reads tighter now)
const TICK_HEIGHT = 7    // px — tick line length at bottom of ruler
const LABEL_Y = 11       // px — text baseline from top of SVG

export interface TimelineAxisProps {
  containerRef: React.RefObject<HTMLDivElement>
  pps: number
  totalWidth: number
  scrollOffset: number
  viewportWidth: number
  currentTime: number
  duration: number
  setScrollOffset: (offset: number) => void
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
  currentTime,
  duration,
  setScrollOffset,
}: TimelineAxisProps) {
  const ticks = generateTicks(duration, pps, scrollOffset, viewportWidth)

  // Cursor pixel position in the visible area (negative = off-screen left)
  const cursorPx = pps > 0 ? currentTime * pps - scrollOffset : -1
  const cursorVisible = cursorPx >= 0 && cursorPx <= viewportWidth

  // Width of SVG content — at minimum fill the viewport
  const svgWidth = Math.max(totalWidth, viewportWidth)

  const hasDocument = duration > 0

  return (
    <div
      className="shrink-0 border-b select-none"
      style={{ borderColor: 'hsl(var(--border))' }}
    >
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: RULER_HEIGHT }}
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
                height: RULER_HEIGHT,
                display: 'block',
              }}
            >
              {/* Ruler background */}
              <rect
                x={0}
                y={0}
                width={svgWidth}
                height={RULER_HEIGHT}
                fill="hsl(var(--background))"
              />

              {/* Tick marks + labels */}
              {ticks.map((tick) => (
                <g key={tick.index} transform={`translate(${tick.x}, 0)`}>
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
                    fontSize={9}
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
                  y2={RULER_HEIGHT}
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* Playback cursor — rendered as a DOM element on top of the SVG */}
            {cursorVisible && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: cursorPx,
                  width: 1,
                  height: RULER_HEIGHT,
                  backgroundColor: 'hsl(var(--primary))',
                  pointerEvents: 'none',
                }}
              />
            )}
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
