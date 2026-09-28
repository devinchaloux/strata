/**
 * Keeping modal dialogs clear of the YouTube player.
 *
 * YouTube's Required Minimum Functionality: "You must not display overlays,
 * frames, or other visual elements in front of any part of a YouTube embedded
 * player, including player controls." A modal's dimming and its box are both
 * such elements. So while a modal is open, the dimming gets a hole where the
 * player is, and the dialog sits in the largest free area around it.
 * docs/decisions.md, "Dialogs Stay Clear of the Player".
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Gap kept between the player and anything a dialog draws. */
export const CLEARANCE = 8

// What a dialog can use: past these sizes, more room doesn't help it.
const USEFUL_W = 640
const USEFUL_H = 560

/**
 * The free area around the player where a dialog fits best: above, below, left
 * or right of it, whichever gives a dialog the most usable room.
 */
export function freeRegion(viewport: { w: number; h: number }, player: Rect): Rect {
  const top = Math.max(0, player.y - CLEARANCE)
  const bottom = Math.min(viewport.h, player.y + player.h + CLEARANCE)
  const left = Math.max(0, player.x - CLEARANCE)
  const right = Math.min(viewport.w, player.x + player.w + CLEARANCE)
  const candidates: Rect[] = [
    { x: 0, y: 0, w: viewport.w, h: top },
    { x: 0, y: bottom, w: viewport.w, h: viewport.h - bottom },
    { x: 0, y: 0, w: left, h: viewport.h },
    { x: right, y: 0, w: viewport.w - right, h: viewport.h },
  ]
  const room = (r: Rect) => Math.min(r.w, USEFUL_W) * Math.min(r.h, USEFUL_H)
  return candidates.reduce((best, r) => (room(r) > room(best) ? r : best))
}

/**
 * A clip-path for a full-screen overlay that leaves a hole over the player.
 * The polygon runs round the viewport, then round the hole the other way; with
 * evenodd filling, the hole is left out.
 */
export function overlayWithHole(viewport: { w: number; h: number }, player: Rect): string {
  const x0 = Math.max(0, player.x - CLEARANCE)
  const y0 = Math.max(0, player.y - CLEARANCE)
  const x1 = Math.min(viewport.w, player.x + player.w + CLEARANCE)
  const y1 = Math.min(viewport.h, player.y + player.h + CLEARANCE)
  const pts = [
    [0, 0], [viewport.w, 0], [viewport.w, viewport.h], [0, viewport.h], [0, 0],
    [x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0],
  ]
  return `polygon(evenodd, ${pts.map(([x, y]) => `${x}px ${y}px`).join(', ')})`
}

// ── The player on screen ────────────────────────────────────────────────────

let playerElement: HTMLElement | null = null

/** PlayerDock registers the YouTube player's box here (null when there is none). */
export function setPlayerElement(el: HTMLElement | null) {
  playerElement = el
}

export function getPlayerElement(): HTMLElement | null {
  return playerElement
}
