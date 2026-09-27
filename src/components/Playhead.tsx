/**
 * Playhead — the vertical playback-cursor line.
 *
 * The only component that re-renders on every playback frame. It reads the
 * playback time straight from the store, so the diagram and the ruler around it
 * don't have to: before this, both subscribed to `currentTime` and redrew every
 * span, label and layer ~60 times a second during playback (measured at ~9 fps
 * on a 4×-throttled CPU with just the three-layer demo).
 */
import { useUIStore } from '@/store/uiStore'
import { computePps } from '@/lib/timeline'

export function Playhead({ height, opacity = 1 }: { height: number; opacity?: number }) {
  const currentTime = useUIStore((s) => s.currentTime)
  const pps = useUIStore((s) => computePps(s.zoom))
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)

  const x = pps > 0 ? currentTime * pps - scrollOffset : -1
  if (x < 0 || x > viewportWidth) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1,
        height,
        // A transform moves the line without triggering layout each frame.
        transform: `translateX(${x}px)`,
        backgroundColor: 'hsl(var(--primary))',
        opacity,
        pointerEvents: 'none',
      }}
    />
  )
}
