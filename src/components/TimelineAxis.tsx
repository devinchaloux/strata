import { useTimeline } from '@/hooks/useTimeline'
import { generateTicks } from '@/lib/timeline'
import { TimelineScrollbar } from './TimelineScrollbar'

const RULER_HEIGHT = 40  // px
const TICK_HEIGHT = 10   // px — tick line length at bottom of ruler
const LABEL_Y = 14       // px — text baseline from top of SVG

export function TimelineAxis() {
  const {
    containerRef,
    zoomIn,
    zoomOut,
    fitToWindow,
    resetTo100,
    setScrollOffset,
    minZoomValue,
    maxZoomValue,
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

        {/* Zoom controls — float at top-right, above the SVG.
            − / 100% (reset to standard scale) / + / Fit (fit-to-window). */}
        {hasDocument && (
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
              padding: '1px 3px',
              border: '1px solid hsl(var(--border))',
            }}
          >
            <ZoomButton onClick={zoomOut} disabled={zoom <= minZoomValue + 1e-6} label="Zoom out">
              −
            </ZoomButton>
            <button
              onClick={resetTo100}
              aria-label="Reset to 100%"
              title="Reset to 100% (standard scale)"
              style={{
                minWidth: 34,
                height: 16,
                fontSize: 9,
                fontFamily: 'ui-monospace, monospace',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'center',
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <ZoomButton onClick={zoomIn} disabled={zoom >= maxZoomValue - 1e-6} label="Zoom in">
              +
            </ZoomButton>
            <span aria-hidden style={{ width: 1, height: 12, background: 'hsl(var(--border))', margin: '0 1px' }} />
            <button
              onClick={fitToWindow}
              aria-label="Fit to window"
              title="Fit the whole track to the window"
              style={{
                height: 16,
                fontSize: 9,
                fontFamily: 'ui-monospace, monospace',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: '0 2px',
                textAlign: 'center',
              }}
            >
              Fit
            </button>
          </div>
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

/** Small +/− icon button with a disabled (faded) state. */
function ZoomButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 16,
        height: 16,
        fontSize: 12,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'default' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}
