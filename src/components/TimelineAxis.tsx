import * as React from 'react'
import { useRef } from 'react'
import { generateTicks, snapTime } from '@/lib/timeline'
import { formatMarkerCaption } from '@/lib/pointMarkerTypes'
import { TimelineScrollbar } from './TimelineScrollbar'
import type { PointMarker, SharedTimePoint, VocabTerm } from '@/types/strata'

const RULER_HEIGHT = 24  // px — condensed ruler (the timeline reads tighter now)
const TICK_HEIGHT = 7    // px — tick line length at bottom of ruler
const LABEL_Y = 11       // px — text baseline from top of SVG

// Marker lane — a distinct strip ABOVE the time ruler, dedicated to point
// markers (document-level events, separate from span boundaries). Clicking
// empty space in the lane places a marker at that time (snapping to nearby
// existing time points); clicking an existing marker selects it; dragging one
// repositions it (also snapping).
const MARKER_LANE_HEIGHT = 14
const MARKER_RADIUS = 3
// Screen-pixel movement before a marker pointerdown is treated as a drag
// rather than a click-to-select.
const MARKER_DRAG_THRESHOLD_PX = 3

export interface TimelineAxisProps {
  containerRef: React.RefObject<HTMLDivElement>
  pps: number
  totalWidth: number
  scrollOffset: number
  viewportWidth: number
  currentTime: number
  duration: number
  setScrollOffset: (offset: number) => void
  pointMarkers?: PointMarker[]
  sharedTimePoints?: SharedTimePoint[]
  selectedMarkerId?: string | null
  onSelectMarker?: (id: string) => void
  onPlaceMarker?: (time: number) => void
  onMoveMarker?: (id: string, time: number) => void
  /** Document-level custom marker types, for resolving a caption's abbreviation. */
  pointMarkerTypes?: VocabTerm[]
  /** StrataDocument.showCadenceCaptions. Absent in the document means true. */
  showCaptions?: boolean
}

// Presentational ruler. The timeline state lives in useTimeline, lifted to
// FormDiagram so the zoom controls can render in the widget top bar (off the
// time labels) — the ruler just draws ticks, cursor, and the scrollbar.
export function TimelineAxis({
  containerRef,
  pps,
  totalWidth,
  scrollOffset,
  viewportWidth,
  currentTime,
  duration,
  setScrollOffset,
  pointMarkers = [],
  sharedTimePoints = [],
  selectedMarkerId = null,
  onSelectMarker,
  onPlaceMarker,
  onMoveMarker,
  pointMarkerTypes = [],
  showCaptions = true,
}: TimelineAxisProps) {
  const ticks = generateTicks(duration, pps, scrollOffset, viewportWidth)
  const laneRef = useRef<HTMLDivElement>(null)

  // Snap candidates: existing span boundaries / shared time points, plus
  // other point markers already on the timeline (excluding `excludeId`, the
  // marker being dragged, so it never "snaps" to its own current position).
  function snapCandidates(excludeId?: string): number[] {
    return [
      ...sharedTimePoints.map((p) => p.timestamp),
      ...pointMarkers.filter((m) => m.id !== excludeId).map((m) => m.timestamp),
    ]
  }

  function laneClientXToTime(clientX: number): number | null {
    const lane = laneRef.current
    if (!lane || pps <= 0) return null
    const rect = lane.getBoundingClientRect()
    const x = clientX - rect.left
    return Math.max(0, Math.min(duration, (x + scrollOffset) / pps))
  }

  // A pointerdown on an existing marker calls stopPropagation, but that only
  // stops the pointerdown — the click event that follows still reaches the
  // lane, which would place a duplicate marker on top of the one just
  // selected. Both gestures start with a pointerdown, so record which target
  // it landed on and let the lane's click defer to it.
  const pointerDownOnMarker = useRef(false)

  function handleLaneClick(e: React.MouseEvent) {
    if (pointerDownOnMarker.current) return
    if (!onPlaceMarker) return
    const time = laneClientXToTime(e.clientX)
    if (time == null) return
    onPlaceMarker(snapTime(time, snapCandidates(), pps))
  }

  // Drag-to-reposition an existing marker. A pointerdown that never moves
  // past the threshold is treated as a click (select); one that does is a
  // drag (live-updates the marker's timestamp, snapping as it goes).
  function beginMarkerDrag(marker: PointMarker) {
    return (e: React.PointerEvent) => {
      e.stopPropagation()
      pointerDownOnMarker.current = true
      if (pps <= 0) return
      const startClientX = e.clientX
      let dragged = false
      const candidates = snapCandidates(marker.id)

      const onMove = (ev: PointerEvent) => {
        if (!dragged && Math.abs(ev.clientX - startClientX) > MARKER_DRAG_THRESHOLD_PX) {
          dragged = true
        }
        if (!dragged) return
        const time = laneClientXToTime(ev.clientX)
        if (time == null) return
        onMoveMarker?.(marker.id, snapTime(time, candidates, pps))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (!dragged) onSelectMarker?.(marker.id)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

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
      {/* Marker lane — ABOVE the tick/number row. Document-level point
          markers, distinct from the span boundary ticks below. Click empty
          space to place one at that time (snapping to nearby existing time
          points); click a marker to select it; drag one to reposition it
          (also snapping). */}
      {hasDocument && (
        <div
          ref={laneRef}
          onPointerDown={() => {
            pointerDownOnMarker.current = false
          }}
          onClick={handleLaneClick}
          role="presentation"
          title="Click to place a point marker"
          className="relative cursor-crosshair select-none"
          style={{
            height: MARKER_LANE_HEIGHT,
            backgroundColor: 'hsl(var(--muted) / 0.3)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: -scrollOffset,
              width: Math.max(totalWidth, viewportWidth),
              height: MARKER_LANE_HEIGHT,
            }}
          >
            {pointMarkers.map((marker) => {
              const x = marker.timestamp * pps
              const selected = marker.id === selectedMarkerId
              const caption = formatMarkerCaption(marker, pointMarkerTypes)
              const label = marker.label || caption || null
              return (
                <React.Fragment key={marker.id}>
                  <div
                    onPointerDown={beginMarkerDrag(marker)}
                    title={label ?? `Marker at ${marker.timestamp.toFixed(2)}s`}
                    className="absolute select-none"
                    style={{
                      left: x - 6,
                      top: 0,
                      width: 12,
                      height: MARKER_LANE_HEIGHT,
                      display: 'flex',
                      justifyContent: 'center',
                      cursor: 'ew-resize',
                      touchAction: 'none',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: MARKER_RADIUS * 2,
                        height: MARKER_RADIUS * 2,
                        marginTop: (MARKER_LANE_HEIGHT - MARKER_RADIUS * 2) / 2,
                        borderRadius: 1,
                        transform: 'rotate(45deg)',
                        backgroundColor: marker.flagged
                          ? 'hsl(var(--destructive))'
                          : 'hsl(var(--primary))',
                        boxShadow: selected ? '0 0 0 2px hsl(var(--ring))' : undefined,
                      }}
                    />
                  </div>
                  {/* Caption sits to the right of the diamond. pointer-events
                      off so it never intercepts a lane click or a drag on a
                      marker underneath it. */}
                  {showCaptions && caption && (
                    <div
                      className="absolute select-none whitespace-nowrap"
                      style={{
                        left: x + 6,
                        top: 0,
                        height: MARKER_LANE_HEIGHT,
                        lineHeight: `${MARKER_LANE_HEIGHT}px`,
                        fontSize: 9,
                        pointerEvents: 'none',
                        color: selected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {caption}
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

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
