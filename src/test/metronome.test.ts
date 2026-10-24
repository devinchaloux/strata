// @vitest-environment jsdom
/**
 * The click track's beats, and beat matching: tempo steps, nudges and pinning
 * a downbeat to find a tempo such as 158.9 BPM.
 */
import { describe, it, expect } from 'vitest'
import type { GridSegment } from '@/types/strata'
import { beatsIn, tempoThroughDownbeat, roundTempo } from '@/lib/metronome'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc } from './fixtures'

// 120 BPM in 4/4: a beat is 0.5 s, a bar 2 s.
const seg = (id: string, start: number, extra: Partial<GridSegment> = {}): GridSegment => ({
  id, start, bpm: 120, beatsPerBar: 4, ...extra,
})

describe('beatsIn', () => {
  it('lists the beats in a window, downbeats marked', () => {
    expect(beatsIn([seg('a', 1)], 60, 2.9, 4.6)).toEqual([
      { time: 3, downbeat: true },
      { time: 3.5, downbeat: false },
      { time: 4, downbeat: false },
      { time: 4.5, downbeat: false },
    ])
  })

  it('leaves the window’s end for the next one, so no beat clicks twice', () => {
    expect(beatsIn([seg('a', 0)], 60, 0, 1).map((b) => b.time)).toEqual([0, 0.5])
    expect(beatsIn([seg('a', 0)], 60, 1, 2).map((b) => b.time)).toEqual([1, 1.5])
  })

  it('is silent in a free stretch', () => {
    expect(beatsIn([seg('a', 0, { end: 10 })], 60, 12, 14)).toEqual([])
  })
})

describe('tempoThroughDownbeat', () => {
  it('finds a fractional tempo from a downbeat far into the track', () => {
    // 158.9 BPM in 4/4 from 0.5 s: bar 101 begins 100 bars later.
    const t = 0.5 + (100 * 4 * 60) / 158.9
    expect(tempoThroughDownbeat(seg('a', 0.5, { bpm: 159 }), t)).toBe(158.9)
  })

  it('needs at least a bar', () => {
    expect(tempoThroughDownbeat(seg('a', 0), 0.8)).toBeNull()
  })

  it('rounds to a thousandth', () => {
    expect(roundTempo(158.90000000001)).toBe(158.9)
  })
})

describe('beat matching in the store', () => {
  const store = () => useDocumentStore.getState()
  const grid = () => store().document!.beatGrid!
  const load = () => store().loadDocument({ ...makeDoc([]), duration: 300, beatGrid: [seg('a', 0.5, { bpm: 159 })] })

  it('steps the tempo of the row at the playhead, its start fixed', () => {
    load()
    store().stepGridTempo(100, -0.1)
    store().stepGridTempo(100, -0.01)
    expect(grid()[0]).toMatchObject({ start: 0.5, bpm: 158.89 })
  })

  it('nudges the row earlier or later, never before 0:00', () => {
    load()
    store().nudgeGrid(100, 0.01)
    expect(grid()[0].start).toBe(0.51)
    store().nudgeGrid(100, -1)
    expect(grid()[0].start).toBe(0)
  })

  it('pins a downbeat to set the tempo', () => {
    load()
    const t = 0.5 + (100 * 4 * 60) / 158.9
    expect(store().pinDownbeat(t)).toEqual({ bpm: 158.9, bars: 100 })
    expect(grid()[0].bpm).toBe(158.9)
  })
})
