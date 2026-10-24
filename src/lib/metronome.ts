/**
 * The click track: a metronome that plays the beat grid over the media, for
 * matching a grid to a track by ear (docs/decisions.md, "Click Track and Beat
 * Matching").
 *
 * The media (a YouTube iframe or an audio element) and the click (Web Audio)
 * run on different clocks, and neither can be driven from the other. So the
 * scheduler keeps a mapping from audio-context time to media time, read from
 * the player every 25 ms, and schedules each click a little ahead on the audio
 * clock, where its timing is exact. A media reading only nudges the mapping
 * (YouTube reports its time in steps, so a single reading can be late); a jump
 * (a seek) or a change of speed resets it.
 *
 * Beats come from the grid (lib/beatGrid.ts gridLines), so a free stretch is
 * silent and a tempo change is followed. Pure helpers are exported for tests.
 */
import type { GridSegment } from '@/types/strata'
import { barLength, gridLines, segmentAt } from '@/lib/beatGrid'

export interface Beat {
  time: number
  downbeat: boolean
}

/** Every beat of the grid in [from, to), downbeats marked. */
export function beatsIn(segs: GridSegment[], duration: number, from: number, to: number): Beat[] {
  if (to <= from) return []
  return gridLines(segs, duration, from, to)
    .filter((l) => l.time >= from && l.time < to)
    .map((l) => ({ time: l.time, downbeat: l.bar !== null }))
}

/**
 * The tempo at which the downbeat nearest `t` lands exactly on `t`, keeping
 * the segment's first downbeat where it is: the analyst pauses on a downbeat
 * far into the track and says "this is a downbeat". The further away, the
 * finer the result (two minutes in at 159 BPM, a 20 ms error in `t` is under
 * 0.03 BPM). Null when `t` is under a bar from the start, or outside `seg`.
 */
export function tempoThroughDownbeat(seg: GridSegment, t: number): number | null {
  const elapsed = t - seg.start
  const bars = Math.round(elapsed / barLength(seg))
  if (bars < 1) return null
  return roundTempo((bars * seg.beatsPerBar * 60) / elapsed)
}

/** Tempo to a thousandth of a BPM, so repeated steps don't gather float noise. */
export function roundTempo(bpm: number): number {
  return Math.round(bpm * 1000) / 1000
}

/** The segment the playhead is in, else the last one before it, else the first. */
export function segmentForAdjusting(segs: GridSegment[], t: number, duration: number): GridSegment | null {
  return segmentAt(segs, t, duration)?.seg ?? [...segs].reverse().find((g) => g.start <= t) ?? segs[0] ?? null
}

// ---------------------------------------------------------------------------
// The scheduler (browser only)
// ---------------------------------------------------------------------------

const LOOKAHEAD = 0.12 // seconds of audio clock scheduled ahead
const TICK_MS = 25
// A reading further than this from the mapping is a jump (a seek), not jitter.
const JUMP = 0.15

export interface ClickSource {
  /** The media's time now, in recording time. */
  now: () => number
  playing: () => boolean
  rate: () => number
  volume: () => number
  beats: (from: number, to: number) => Beat[]
}

export class ClickScheduler {
  private ctx: AudioContext | null = null
  private timer: number | null = null
  private anchor: { media: number; audio: number; rate: number } | null = null
  private lastReading = NaN
  private scheduledTo = -Infinity
  private voices: { osc: OscillatorNode; at: number }[] = []
  private source: ClickSource

  constructor(source: ClickSource) {
    this.source = source
  }

  start() {
    if (this.timer != null) return
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.ctx ??= new Ctx()
    void this.ctx.resume()
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  stop() {
    if (this.timer != null) window.clearInterval(this.timer)
    this.timer = null
    this.reset()
  }

  dispose() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }

  /** Forget the mapping and silence clicks already scheduled (after a pause, seek or grid edit). */
  reset() {
    this.anchor = null
    this.scheduledTo = -Infinity
    const now = this.ctx?.currentTime ?? 0
    for (const v of this.voices) if (v.at > now) v.osc.stop()
    this.voices = []
  }

  private tick() {
    const ctx = this.ctx
    if (!ctx) return
    if (!this.source.playing()) {
      if (this.anchor) this.reset()
      return
    }
    const audio = ctx.currentTime
    const rate = this.source.rate()
    const reading = this.source.now()
    if (!this.anchor || this.anchor.rate !== rate) {
      this.anchor = { media: reading, audio, rate }
      this.scheduledTo = reading
    } else if (reading !== this.lastReading) {
      // A fresh reading: ease the mapping towards it, or start again on a jump.
      const predicted = this.anchor.media + (audio - this.anchor.audio) * rate
      const error = reading - predicted
      if (Math.abs(error) > JUMP) {
        this.reset()
        this.anchor = { media: reading, audio, rate }
        this.scheduledTo = reading
      } else {
        this.anchor = { media: predicted + error * 0.2, audio, rate }
      }
    }
    this.lastReading = reading
    const a = this.anchor
    const mediaNow = a.media + (audio - a.audio) * rate
    const horizon = mediaNow + LOOKAHEAD * rate
    for (const beat of this.source.beats(Math.max(this.scheduledTo, mediaNow), horizon)) {
      this.click(a.audio + (beat.time - a.media) / rate, beat.downbeat)
    }
    this.scheduledTo = Math.max(this.scheduledTo, horizon)
    this.voices = this.voices.filter((v) => v.at > audio - 0.1)
  }

  private click(at: number, accent: boolean) {
    const ctx = this.ctx!
    const when = Math.max(at, ctx.currentTime)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = accent ? 1760 : 1180
    const peak = Math.max(0.0001, this.source.volume() * (accent ? 1 : 0.6))
    gain.gain.setValueAtTime(peak, when)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.035)
    osc.connect(gain).connect(ctx.destination)
    osc.start(when)
    osc.stop(when + 0.04)
    this.voices.push({ osc, at: when })
  }
}
