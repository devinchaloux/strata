import { useTimeline } from '@/hooks/useTimeline'
import { generateTicks } from '@/lib/timeline'
import { MIN_ZOOM } from '@/lib/timeline'

const RULER_HEIGHT = 40  // px
const TICK_HEIGHT = 10   // px — tick line length at bottom of ruler
const LABEL_Y = 14       // px — text baseline from top of SVG

export function TimelineAxis() {
  const {
    containerRef,
    zoomIn,
    zoomOut,
    resetZoom,
    pps,
    totalWidth,
    zoom,
    scrollOffset,
    viewportWidth,
    currentTime,
    duration,
  } = useTimeline()

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
                    fontFamily="ui-monospace, monospace"
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

        {/* Zoom controls — float at top-right, above the SVG */}
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 10,
            backgroundColor: 'hsl(var(--background))',
            borderRadius: 4,
            padding: '1px 4px',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            style={{
              width: 16,
              height: 16,
              fontSize: 12,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: zoom <= MIN_ZOOM ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              opacity: zoom <= MIN_ZOOM ? 0.3 : 1,
              cursor: zoom <= MIN_ZOOM ? 'default' : 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
            }}
          >
            −
          </button>
          <button
            onClick={resetZoom}
            disabled={zoom <= MIN_ZOOM && scrollOffset === 0}
            aria-label="Reset zoom"
            title="Reset to fit"
            style={{
              minWidth: 32,
              height: 16,
              fontSize: 9,
              fontFamily: 'ui-monospace, monospace',
              color:
                zoom <= MIN_ZOOM
                  ? 'hsl(var(--muted-foreground))'
                  : 'hsl(var(--foreground))',
              opacity: zoom <= MIN_ZOOM && scrollOffset === 0 ? 0.4 : 1,
              cursor: zoom <= MIN_ZOOM && scrollOffset === 0 ? 'default' : 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'center',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={zoom >= 200}
            aria-label="Zoom in"
            style={{
              width: 16,
              height: 16,
              fontSize: 12,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: zoom >= 200 ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              opacity: zoom >= 200 ? 0.3 : 1,
              cursor: zoom >= 200 ? 'default' : 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
