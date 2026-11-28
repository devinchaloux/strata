/**
 * HeadphoneDelayPanel — the listening delay, in the play bar's settings menu
 * (PlaybackSettingsMenu; lib/listeningDelay.ts; docs/decisions.md, "Listening
 * Delay Is the Listener's").
 *
 * Bluetooth headphones play sound some 150–300 ms after the player reaches it.
 * With the delay on, the playhead follows what is heard and marks land where
 * they're heard. The switch is quick to reach because it follows the
 * headphones in use: on for Bluetooth, off for wired; the amount is kept.
 *
 * Calibrating: a click plays every 0.6 s and a dot flashes the set delay after
 * each one is sent. Moving the slider until they land together measures the
 * headphones alone. Tapping along would add the analyst's own habit of tapping
 * early or late, which their wired marks already carry.
 */
import { useEffect, useRef, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { useUIStore } from '@/store/uiStore'
import { MAX_LISTENING_DELAY_MS } from '@/lib/listeningDelay'

const PERIOD = 0.6 // seconds between calibration clicks
const FLASH = 0.07 // seconds the dot stays lit

export function HeadphoneDelayPanel() {
  const on = useUIStore((s) => s.listeningDelayOn)
  const setOn = useUIStore((s) => s.setListeningDelayOn)
  const delayMs = useUIStore((s) => s.listeningDelayMs)
  const setDelayMs = useUIStore((s) => s.setListeningDelayMs)
  const [calibrating, setCalibrating] = useState(false)
  const delayRef = useRef(delayMs)
  useEffect(() => { delayRef.current = delayMs }, [delayMs])
  const dotRef = useRef<HTMLSpanElement>(null)

  // The calibration click and flash. Clicks are scheduled ahead on the audio
  // clock, where their timing is exact; the dot reads the same clock.
  useEffect(() => {
    if (!calibrating) return
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (useUIStore.getState().playbackState === 'playing') useUIStore.getState().requestPlay(false)
    const ctx = new Ctx()
    void ctx.resume()
    const first = ctx.currentTime + 0.2
    let scheduled = 0
    let raf = 0
    function tick() {
      const t = ctx.currentTime
      while (first + scheduled * PERIOD < t + 0.15) {
        const at = first + scheduled * PERIOD
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 1500
        gain.gain.setValueAtTime(0.5, at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035)
        osc.connect(gain).connect(ctx.destination)
        osc.start(at)
        osc.stop(at + 0.04)
        scheduled++
      }
      const since = t - first - delayRef.current / 1000
      const lit = since >= 0 && since % PERIOD < FLASH
      if (dotRef.current) dotRef.current.style.opacity = lit ? '1' : '0.15'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      void ctx.close()
    }
  }, [calibrating])

  return (
    <div className="text-xs">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Use this delay</p>
          <Switch
            checked={on}
            onCheckedChange={setOn}
            aria-label="Take off the headphone delay"
            title="On for Bluetooth headphones, off for wired"
          />
        </div>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Bluetooth headphones play a little late. Set how late, and the playhead follows what you hear and
          marks land where you hear them. This browser keeps it; your files don’t change.
        </p>

        <label className="mt-3 flex items-center gap-2 text-muted-foreground">
          <input
            type="range"
            min={0}
            max={MAX_LISTENING_DELAY_MS}
            step={5}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            className="flex-1 accent-(--ink-primary)"
            aria-label="Headphone delay in milliseconds"
          />
          <span className="w-14 text-right font-medium tabular-nums text-foreground">{delayMs} ms</span>
        </label>
        <div className="mt-1 flex items-center gap-1">
          {[-5, 5].map((d) => (
            <button
              key={d}
              className="rounded border border-border px-1.5 py-0.5 tabular-nums text-foreground hover:bg-accent"
              onClick={() => setDelayMs(delayMs + d)}
              aria-label={d < 0 ? 'Delay 5 ms shorter' : 'Delay 5 ms longer'}
            >
              {d < 0 ? '−5' : '+5'}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-foreground">Calibrate</p>
            <button
              className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent"
              onClick={() => setCalibrating((c) => !c)}
              aria-pressed={calibrating}
            >
              {calibrating ? 'Stop' : 'Start'}
            </button>
          </div>
          {calibrating ? (
            <div className="mt-2 flex items-center gap-3">
              <span ref={dotRef} aria-hidden className="h-6 w-6 shrink-0 rounded-full bg-primary" style={{ opacity: 0.15 }} />
              <p className="leading-relaxed text-muted-foreground">
                Move the slider until the dot flashes exactly with the click.
              </p>
            </div>
          ) : (
            <p className="mt-1 leading-relaxed text-muted-foreground">
              With the headphones on, play a click and match a flash to it.
            </p>
          )}
        </div>
    </div>
  )
}
