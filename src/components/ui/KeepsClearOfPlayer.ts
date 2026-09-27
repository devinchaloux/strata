/**
 * Rendered inside every modal's content, which Radix mounts only while the
 * modal is open. While any is open, it measures the YouTube player and sets
 * CSS variables the shared overlay and content classes read: a hole in the
 * dimming over the player, and a position and height for the dialog in the
 * largest free area. With no YouTube player, nothing is set and dialogs centre
 * as usual. See lib/playerClearance.ts for the rule this follows.
 */
import { useEffect } from 'react'
import { freeRegion, getPlayerElement, overlayWithHole } from '@/lib/playerClearance'

const VARS = ['--modal-hole', '--modal-x', '--modal-y', '--modal-max-h'] as const
let open = 0

function place() {
  const root = document.documentElement.style
  const el = getPlayerElement()
  const r = el?.getBoundingClientRect()
  if (!r || r.width === 0) {
    VARS.forEach((v) => root.removeProperty(v))
    return
  }
  const viewport = { w: window.innerWidth, h: window.innerHeight }
  const player = { x: r.left, y: r.top, w: r.width, h: r.height }
  const region = freeRegion(viewport, player)
  root.setProperty('--modal-hole', overlayWithHole(viewport, player))
  root.setProperty('--modal-x', `${region.x + region.w / 2}px`)
  root.setProperty('--modal-y', `${region.y + region.h / 2}px`)
  root.setProperty('--modal-max-h', `${Math.max(160, region.h - 32)}px`)
}

export function KeepsClearOfPlayer() {
  useEffect(() => {
    open++
    place()
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      if (--open === 0) VARS.forEach((v) => document.documentElement.style.removeProperty(v))
    }
  }, [])
  return null
}
