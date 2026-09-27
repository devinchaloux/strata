/**
 * Rendered inside every modal's content, which Radix mounts only while the
 * modal is open. While any is open, it measures the YouTube player and sets
 * CSS variables the shared overlay and content classes read: a hole in the
 * dimming over the player, and a position and height for the dialog in the
 * largest free area. With no YouTube player, or one scrolled out of view,
 * nothing is set and dialogs centre as usual. See lib/playerClearance.ts for the rule this follows.
 */
import { useEffect } from 'react'
import { freeRegion, getPlayerElement, overlayWithHole } from '@/lib/playerClearance'

const VARS = ['--modal-hole', '--modal-x', '--modal-y', '--modal-max-h'] as const
let open = 0

function place() {
  const root = document.documentElement.style
  const el = getPlayerElement()
  const r = el?.getBoundingClientRect()
  const viewport = { w: window.innerWidth, h: window.innerHeight }
  // Only the part of the player on screen matters: scrolled out of view, a
  // dialog can't be in front of it, so dialogs centre as usual.
  const x0 = Math.max(0, r?.left ?? 0)
  const y0 = Math.max(0, r?.top ?? 0)
  const x1 = Math.min(viewport.w, r?.right ?? 0)
  const y1 = Math.min(viewport.h, r?.bottom ?? 0)
  if (!r || x1 <= x0 || y1 <= y0) {
    VARS.forEach((v) => root.removeProperty(v))
    return
  }
  const player = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
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
