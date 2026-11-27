import { useUIStore } from '@/store/uiStore'
import type { PlayheadClock, ClockState } from '@/lib/listeningDelay'

/**
 * The time being heard, from a player reading in recording time, with this
 * browser's listening delay taken off while it plays (lib/listeningDelay.ts).
 * Both engines read through this; `remember` is false for a one-off look.
 */
export function heardTime(clock: PlayheadClock, reading: number, remember = true): number {
  const ui = useUIStore.getState()
  const state: ClockState =
    ui.playbackState === 'playing' ? 'playing' : ui.playbackState === 'buffering' ? 'buffering' : 'stopped'
  const delay = ui.listeningDelayOn ? ui.listeningDelayMs : 0
  return remember
    ? clock.read(reading, state, delay, ui.playbackRate)
    : clock.peek(reading, state, delay, ui.playbackRate)
}
