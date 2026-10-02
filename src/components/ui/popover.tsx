/**
 * Popover — shadcn/ui primitive over @radix-ui/react-popover.
 *
 * Radix handles the hard parts: focus management, Escape-to-close, click-outside,
 * collision-aware positioning (flips when it would run off-screen), and portal
 * rendering so the panel is never clipped by a parent's `overflow: hidden`.
 *
 * One addition: an open popover keeps clear of the YouTube player. Nothing may
 * cover the player (YouTube's rules), and it sits above every menu, so a menu
 * that opens over it would be hidden behind it. On opening, and while the
 * window changes, the panel measures itself and shifts by the smallest move
 * that clears the player (lib/playerClearance.nudgeClear), using the CSS
 * `translate` property so Radix's own positioning and animation are untouched.
 */

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
import { getPlayerElement, nudgeClear } from '@/lib/playerClearance'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

/**
 * Shift an open panel off the YouTube player. The wrapper stays mounted while
 * the popover is closed (Radix mounts the panel itself only when open), so the
 * measuring starts when the panel's node attaches, not when this mounts.
 */
function useClearOfPlayer() {
  const node = React.useRef<HTMLDivElement | null>(null)
  const shiftRef = React.useRef({ dx: 0, dy: 0 })
  const [shift, setShift] = React.useState({ dx: 0, dy: 0 })
  const stop = React.useRef<() => void>(() => {})

  const attach = React.useCallback((el: HTMLDivElement | null) => {
    // Radix re-attaches refs on re-renders: detaching only pauses the
    // measuring, and the same panel re-attaching keeps its shift. A different
    // panel (the next opening) starts from no shift.
    stop.current()
    if (!el) return
    if (el !== node.current) {
      node.current = el
      if (shiftRef.current.dx || shiftRef.current.dy) {
        shiftRef.current = { dx: 0, dy: 0 }
        setShift(shiftRef.current)
      }
    }
    let raf = 0
    let frames = 0
    const measure = () => {
      const player = getPlayerElement()
      if (!node.current || !player) return
      const r = node.current.getBoundingClientRect()
      const p = player.getBoundingClientRect()
      const s = shiftRef.current
      const next = nudgeClear(
        { x: r.left - s.dx, y: r.top - s.dy, w: r.width, h: r.height },
        { x: p.left, y: p.top, w: p.width, h: p.height },
        { w: window.innerWidth, h: window.innerHeight },
      )
      if (next.dx !== s.dx || next.dy !== s.dy) {
        shiftRef.current = next
        setShift(next)
      }
    }
    // Radix places and animates the panel over its first frames, so measure
    // for a moment after it appears, then again whenever the window changes.
    const settle = () => {
      measure()
      if (++frames < 20) raf = requestAnimationFrame(settle)
    }
    const again = () => {
      frames = 0
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(settle)
    }
    // Never measure during React's commit: the DOM may not show the latest
    // shift yet, and a state change there would loop.
    raf = requestAnimationFrame(settle)
    window.addEventListener('resize', again)
    window.addEventListener('scroll', again, true)
    stop.current = () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', again)
      window.removeEventListener('scroll', again, true)
    }
  }, [])
  React.useEffect(() => () => stop.current(), [])
  return { attach, style: shift.dx || shift.dy ? { translate: `${shift.dx}px ${shift.dy}px` } : undefined }
}

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, style, ...props }, ref) => {
  const clear = useClearOfPlayer()
  const { attach } = clear
  const forwarded = React.useRef(ref)
  forwarded.current = ref
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      attach(node)
      const r = forwarded.current
      if (typeof r === 'function') r(node)
      else if (r) r.current = node
    },
    [attach],
  )
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={setRefs}
        align={align}
        sideOffset={sideOffset}
        style={{ ...style, ...clear.style }}
        className={cn(
          'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
