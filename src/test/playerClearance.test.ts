import { describe, it, expect } from 'vitest'
import { freeRegion, overlayWithHole, CLEARANCE } from '@/lib/playerClearance'

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
