import { useRef, useState } from 'react'
import { formatTime } from '@/lib/youtube'
import type { SharedTimePoint } from '@/types/strata'

interface SeekBarProps {
  currentTime: number
  duration: number
  sharedTimePoints: SharedTimePoint[]
  disabled?: boolean
  onSeek: (time: number) => void
}

export function SeekBar({
  currentTime,
  duration,
  sharedTimePoints,
  disabled,
  onSeek,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const [hoverPercent, setHoverPercent] = useState<number | null>(null)

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0

  // Only labeled, widget-contributed entries — no BPM grid ticks (sourceLayerId: null)
  const ticks = sharedTimePoints.filter(
    (tp) => tp.label != null && tp.label !== '' && duration > 0,
  )

  function fractionFromPointer(e: React.PointerEvent | React.MouseEvent): number {
    const bar = barRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDragging.current = true
    onSeek(fractionFromPointer(e) * duration)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (e.buttons === 0) {
      // No button held — self-correct in case isDragging got stuck
      isDragging.current = false
      return
    }
    if (!isDragging.current) return
    onSeek(fractionFromPointer(e) * duration)
  }

  function handlePointerUp() {
    isDragging.current = false
  }

  function handlePointerCancel() {
    isDragging.current = false
  }

  function handleMouseMove(e: React.MouseEvent) {
    setHoverPercent(fractionFromPointer(e) * 100)
  }

  function handleMouseLeave() {
    setHoverPercent(null)
  }

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuenow={Math.round(currentTime)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      className={`relative flex-1 h-2 rounded select-none ${
        disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
      }`}
      style={{ backgroundColor: 'hsl(var(--muted))' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Filled track */}
      <div
        className="absolute inset-y-0 left-0 rounded"
        style={{
          width: `${progress * 100}%`,
          backgroundColor: 'hsl(var(--primary))',
        }}
      />

      {/* Tick marks — labeled shared time points only */}
      {ticks.map((tp) => (
        <div
          key={tp.id}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(tp.timestamp / duration) * 100}%`,
            width: 2,
            height: 8,
            backgroundColor: 'hsl(var(--border))',
            opacity: 0.6,
          }}
        />
      ))}

      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full pointer-events-none"
        style={{
          left: `${progress * 100}%`,
          backgroundColor: 'hsl(var(--primary))',
          boxShadow: '0 0 0 2px hsl(var(--background))',
        }}
      />

      {/* Hover tooltip */}
      {hoverPercent !== null && duration > 0 && (
        <div
          className="absolute bottom-full mb-2 -translate-x-1/2 rounded px-1.5 py-0.5 text-xs whitespace-nowrap pointer-events-none z-10"
          style={{
            left: `${hoverPercent}%`,
            backgroundColor: 'hsl(var(--popover))',
            color: 'hsl(var(--popover-foreground))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          {formatTime((hoverPercent / 100) * duration)}
        </div>
      )}
    </div>
  )
}
