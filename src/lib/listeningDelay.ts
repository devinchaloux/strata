/**
 * Listening delay (docs/decisions.md, "Listening Delay Is the Listener's"):
 * Bluetooth headphones play sound some 150–300 ms after the player reaches
 * it, so a playhead that follows the player runs ahead of what is heard, and
 * a mark tapped by ear lands late. The delay belongs to this browser and its
 * headphones, never to a document: the analyst's marks stay recording-time
 * truth, and the delay is taken off the player's reading as it plays.
 *
 * Pure: the playhead clock both engines read through, the bounds of the
 * setting, and the one-off repair for an analysis marked by ear with an
 * uncorrected delay (shiftAllTimes).
 */
import type { StrataDocument, Layer } from '@/types/strata'
import { MIN_SPAN_WIDTH } from '@/lib/spanEdit'

/** The largest delay the setting takes, in milliseconds. Bluetooth codecs run to about 300. */
export const MAX_LISTENING_DELAY_MS = 500

/** A delay in milliseconds, as a whole number in [0, MAX_LISTENING_DELAY_MS]; 0 for anything unreadable. */
export function clampDelayMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0
  return Math.min(MAX_LISTENING_DELAY_MS, Math.max(0, Math.round(ms)))
}

export type ClockState = 'playing' | 'buffering' | 'stopped'

/**
 * The playhead's clock: turns the player's readings (recording time) into the
 * time being heard.
 *
 * - Playing, the delay comes off the reading, scaled by the playback rate
 *   (the delay is wall-clock time; at 0.5× it covers half as much music).
 * - Playing, the playhead never steps back by less than a jump. YouTube's
 *   reading runs on for a moment when Play is pressed and then snaps back
 *   once the sound starts; and when playback starts, the heard time is
 *   behind the paused position until the delay has passed. Both now hold the
 *   playhead still instead of moving it back.
 * - Buffering, it holds: nothing is being heard.
 * - Stopped (paused, ended, cued), it is the reading: the sound has stopped.
 *
 * A seek sets the clock outright, so the hold starts from where it landed.
 */
export class PlayheadClock {
  private last: number | null = null

  /** Where a seek landed, in recording time. */
  seek(time: number) {
    this.last = Math.max(0, time)
  }

  /** The time being heard, given the player's reading; and remember it. */
  read(reading: number, state: ClockState, delayMs: number, rate: number): number {
    const t = this.peek(reading, state, delayMs, rate)
    this.last = t
    return t
  }

  /** As read, without remembering it. */
  peek(reading: number, state: ClockState, delayMs: number, rate: number): number {
    const last = this.last
    if (state === 'stopped' || last == null) return Math.max(0, reading)
    if (state === 'buffering') return last
    const lag = (clampDelayMs(delayMs) / 1000) * rate
    const heard = Math.max(0, reading - lag)
    // A step back further than this is a real jump (the player moved on its
    // own, or looped), not a start-up wobble.
    const jump = lag + 0.5
    return heard < last && last - heard < jump ? last : heard
  }
}

// ---------------------------------------------------------------------------
// Repair: move every time in a document
// ---------------------------------------------------------------------------

export type ShiftResult = { ok: true; document: StrataDocument } | { ok: false; reason: string }

const ms = (t: number) => Math.round(t * 1000) / 1000

/**
 * Every time in the document moved by `seconds` (negative = earlier): span
 * boundaries, point markers, the beat grid and commentary ranges. For an
 * analysis marked by ear while the headphones' delay went uncorrected, where
 * every mark landed that much late.
 *
 * The start and end of the recording stay put: a boundary on 0:00 or on the
 * track's end marks the recording's edge, not something heard. Anything else
 * is kept inside the track. A span that would shrink below the shortest a
 * span can be refuses the whole shift rather than losing it.
 */
export function shiftAllTimes(doc: StrataDocument, seconds: number): ShiftResult {
  if (!Number.isFinite(seconds) || seconds === 0) return { ok: false, reason: 'Nothing to move.' }
  const end = doc.duration
  const move = (t: number) => {
    if (t <= 0 || (end > 0 && t >= end)) return t
    const moved = ms(t + seconds)
    return end > 0 ? Math.min(end, Math.max(0, moved)) : Math.max(0, moved)
  }

  let squeezed: string | null = null
  const layers: Layer[] = doc.layers.map((layer) => {
    if (layer.type === 'segmentation') {
      const spans = layer.data.spans.map((s) => {
        const startTime = move(s.startTime)
        const endTime = move(s.endTime)
        if (endTime - startTime < MIN_SPAN_WIDTH) squeezed ??= s.label || layer.label
        return { ...s, startTime, endTime }
      })
      return { ...layer, data: { ...layer.data, spans } }
    }
    if (layer.type === 'written-analysis') {
      const blocks = layer.data.blocks.map((b) =>
        'spanId' in b.anchor ? b : { ...b, anchor: { start: move(b.anchor.start), end: move(b.anchor.end) } },
      )
      return { ...layer, data: { ...layer.data, blocks } }
    }
    return layer
  })
  if (squeezed) return { ok: false, reason: `“${squeezed}” is too short to move that far.` }

  return {
    ok: true,
    document: {
      ...doc,
      layers,
      pointMarkers: doc.pointMarkers.map((m) => ({ ...m, timestamp: move(m.timestamp) })),
      ...(doc.beatGrid && {
        beatGrid: doc.beatGrid.map((g) => ({ ...g, start: move(g.start), ...(g.end != null && { end: move(g.end) }) })),
      }),
    },
  }
}
