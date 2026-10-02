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
 * or right of it, whichever gives a dialog the most usable room. With the
 * dialog's own size (`need`), room past that size doesn't count, so a wide
 * dialog goes where it fits rather than into a tall, narrow strip.
 */
export function freeRegion(viewport: { w: number; h: number }, player: Rect, need?: { w: number; h: number }): Rect {
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
  const useW = need?.w || USEFUL_W
  const useH = need?.h || USEFUL_H
  const room = (r: Rect) => Math.min(r.w, useW) * Math.min(r.h, useH)
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

/**
 * How far to move a popover (menu, picker) so it is clear of the player:
 * the smallest shift left, right, up or down that clears it and still fits
 * the window. {0, 0} when it doesn't overlap; when nothing fits, the shift
 * that leaves the least overlap. docs/decisions.md, "Menus Keep Clear of
 * the Player".
 */
export function nudgeClear(content: Rect, player: Rect, viewport: { w: number; h: number }): { dx: number; dy: number } {
  const overlap = (r: Rect) =>
    Math.max(0, Math.min(r.x + r.w, player.x + player.w + CLEARANCE) - Math.max(r.x, player.x - CLEARANCE)) *
    Math.max(0, Math.min(r.y + r.h, player.y + player.h + CLEARANCE) - Math.max(r.y, player.y - CLEARANCE))
  if (overlap(content) === 0) return { dx: 0, dy: 0 }
  const moves = [
    { dx: player.x - CLEARANCE - (content.x + content.w), dy: 0 }, // to its left
    { dx: player.x + player.w + CLEARANCE - content.x, dy: 0 }, // to its right
    { dx: 0, dy: player.y - CLEARANCE - (content.y + content.h) }, // above it
    { dx: 0, dy: player.y + player.h + CLEARANCE - content.y }, // below it
  ]
  const fits = (m: { dx: number; dy: number }) => {
    const x = content.x + m.dx
    const y = content.y + m.dy
    return x >= 0 && y >= 0 && x + content.w <= viewport.w && y + content.h <= viewport.h
  }
  const size = (m: { dx: number; dy: number }) => Math.abs(m.dx) + Math.abs(m.dy)
  const fitting = moves.filter(fits).sort((a, b) => size(a) - size(b))
  if (fitting.length) return fitting[0]
  // Nothing fits whole: keep the move that leaves least of it over the player.
  const shifted = (m: { dx: number; dy: number }) => ({ ...content, x: content.x + m.dx, y: content.y + m.dy })
  return [{ dx: 0, dy: 0 }, ...moves].sort((a, b) => overlap(shifted(a)) - overlap(shifted(b)))[0]
}
