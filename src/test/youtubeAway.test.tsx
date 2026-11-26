// @vitest-environment jsdom
/**
 * While Help is open the YouTube player is off the page, not covered
 * (docs/decisions.md, "Help Is a Page"): useYouTubePlayer destroys it, keeps
 * the time and rate, and builds the next one there, paused.
 */
import { describe, it, expect, vi, beforeAll, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer'
import { useUIStore } from '@/store/uiStore'

interface Fake {
  t: number
  destroyed: boolean
  seekTo: Mock<(t: number) => void>
  pauseVideo: Mock<() => void>
  setPlaybackRate: Mock<(r: number) => void>
}
const made: Fake[] = []

beforeAll(() => {
  class Player {
    fake: Fake
    constructor(_el: HTMLElement, opts: { events: { onReady: (e: { target: unknown }) => void } }) {
      this.fake = { t: 0, destroyed: false, seekTo: vi.fn<(t: number) => void>(), pauseVideo: vi.fn<() => void>(), setPlaybackRate: vi.fn<(r: number) => void>() }
      made.push(this.fake)
      queueMicrotask(() => opts.events.onReady({ target: this }))
    }
    getCurrentTime() { return this.fake.t }
    getDuration() { return 200 }
    getPlayerState() { return 2 }
    seekTo(t: number) { this.fake.seekTo(t); this.fake.t = t }
    pauseVideo() { this.fake.pauseVideo() }
    setPlaybackRate(r: number) { this.fake.setPlaybackRate(r) }
    destroy() { this.fake.destroyed = true }
  }
  ;(window as unknown as { YT: unknown }).YT = { Player }
})

describe('the YouTube player while Help is open', () => {
  it('goes away and comes back at the same time and rate, paused', async () => {
    const ref = { current: document.createElement('div') }
    const { rerender } = renderHook(
      ({ id, away }: { id: string | null; away: boolean }) => useYouTubePlayer(ref, id, 2, away),
      { initialProps: { id: 'abc' as string | null, away: false } },
    )
    await act(async () => {})
    expect(made).toHaveLength(1)
    made[0].t = 47 // player time: 45 s of recording time with the 2 s offset
    useUIStore.getState().setPlaybackRate(0.75)

    rerender({ id: null, away: true })
    expect(made[0].destroyed).toBe(true)
    expect(useUIStore.getState().playbackRate).toBe(0.75)
    expect(useUIStore.getState().duration).toBeGreaterThan(0)

    rerender({ id: 'abc', away: false })
    await act(async () => {})
    expect(made).toHaveLength(2)
    expect(made[1].seekTo).toHaveBeenCalledWith(47)
    expect(made[1].pauseVideo).toHaveBeenCalled()
    expect(made[1].setPlaybackRate).toHaveBeenCalledWith(0.75)
    expect(useUIStore.getState().currentTime).toBe(45)
  })
})
