import { describe, it, expect } from 'vitest'
import { freeRegion, overlayWithHole, nudgeClear, CLEARANCE } from '@/lib/playerClearance'

const viewport = { w: 1440, h: 900 }

describe('freeRegion', () => {
  it('puts a dialog above a player docked along the bottom', () => {
    const player = { x: 0, y: 700, w: 1152, h: 200 }
    expect(freeRegion(viewport, player)).toEqual({ x: 0, y: 0, w: 1440, h: 700 - CLEARANCE })
  })

  it('puts a dialog below a mini player in the top corner', () => {
    const player = { x: 784, y: 52, w: 356, h: 200 }
    expect(freeRegion(viewport, player)).toEqual({ x: 0, y: 260, w: 1440, h: 640 })
  })

  it('uses the side when above and below are too short', () => {
    const player = { x: 900, y: 100, w: 400, h: 700 }
    expect(freeRegion(viewport, player)).toEqual({ x: 0, y: 0, w: 892, h: 900 })
  })
})

describe('overlayWithHole', () => {
  it('cuts the player (plus clearance) out of a full-screen polygon', () => {
    const path = overlayWithHole(viewport, { x: 100, y: 700, w: 400, h: 200 })
    expect(path.startsWith('polygon(evenodd, 0px 0px, 1440px 0px, 1440px 900px, 0px 900px, 0px 0px')).toBe(true)
    expect(path).toContain('92px 692px, 92px 900px, 508px 900px, 508px 692px, 92px 692px)')
  })
})

describe('nudgeClear', () => {
  const vp = { w: 1440, h: 900 }
  const player = { x: 900, y: 50, w: 356, h: 200 }
  it('leaves a menu that is already clear', () => {
    expect(nudgeClear({ x: 100, y: 100, w: 300, h: 300 }, player, vp)).toEqual({ dx: 0, dy: 0 })
  })
  it('takes the smallest move that clears the player and fits the window', () => {
    // Overlapping the player's left edge by 50px: moving left is cheapest.
    expect(nudgeClear({ x: 650, y: 100, w: 300, h: 200 }, player, vp)).toEqual({ dx: -58, dy: 0 })
    // Sitting just under its bottom: moving down is cheapest.
    expect(nudgeClear({ x: 950, y: 230, w: 200, h: 200 }, player, vp)).toEqual({ dx: 0, dy: 28 })
  })
})
