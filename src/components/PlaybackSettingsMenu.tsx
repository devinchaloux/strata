/**
 * PlaybackSettingsMenu — the ⚙ in the play bar, as in YouTube's player
 * (docs/decisions.md, "Speed and Delay in One Settings Menu"). It holds what is
 * set now and then rather than worked during playback: the speed (presets and
 * a custom speed for microtiming), the headphone delay, and, in the editor,
 * changing the source and where the video sits.
 *
 * A speed other than 1× shows beside the ⚙, and a dot shows while the
 * headphone delay is on, so neither changes playback out of sight. In an
 * embed the menu is quiet: the ⚙ alone (with the speed when it isn't 1×),
 * holding only speed and delay.
 */
import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HeadphoneDelayPanel } from '@/components/HeadphoneDelayPanel'
import { useUIStore } from '@/store/uiStore'
import { Switch } from '@/components/ui/switch'
import { PRESET_RATES, clampRate, formatRate, rateRange, type SourceKind } from '@/lib/playbackRate'

type View = 'main' | 'speed' | 'delay'

const row =
  'flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-foreground hover:bg-accent disabled:opacity-40 disabled:pointer-events-none'

export function PlaybackSettingsMenu({
  ready,
  sourceKind,
  onRate,
  embed,
  onChangeSource,
  videoPlacement,
}: {
  /** Whether the media is loaded; speed waits for it. */
  ready: boolean
  sourceKind: SourceKind
  onRate: (rate: number) => void
  embed: boolean
  /** Shown when given: the editor's "Change source…". */
  onChangeSource?: () => void
  /** Shown when given: docked below or in the corner. */
  videoPlacement?: { mini: boolean; toggle: () => void }
}) {
  const rate = useUIStore((s) => s.playbackRate)
  const delayOn = useUIStore((s) => s.listeningDelayOn)
  const delayMs = useUIStore((s) => s.listeningDelayMs)
  const keepPitch = useUIStore((s) => s.keepPitch)
  const setKeepPitch = useUIStore((s) => s.setKeepPitch)
  const [view, setView] = useState<View>('main')
  const [open, setOpen] = useState(false)
  const range = rateRange(sourceKind)
  const custom = !PRESET_RATES.some((r) => Math.abs(r - rate) < 0.001)
  const [customText, setCustomText] = useState('')

  function close() {
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setView('main')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Playback settings: speed and headphone delay"
          aria-label="Playback settings"
          className="relative flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-xs text-foreground transition-colors hover:bg-accent
            focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
        >
          <Settings size={15} strokeWidth={1.75} aria-hidden />
          {rate !== 1 && <span className="tabular-nums">{formatRate(rate)}</span>}
          {delayOn && !embed && (
            <span aria-label="Headphone delay on" className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-1.5 text-xs">
        {view === 'main' && (
          <div className="flex flex-col">
            <button className={row} disabled={!ready} onClick={() => setView('speed')}>
              <span>Speed</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {rate === 1 ? 'Normal' : formatRate(rate)}
                <ChevronRight size={13} aria-hidden />
              </span>
            </button>
            <button className={row} onClick={() => setView('delay')}>
              <span>Headphone delay</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {delayOn ? `${delayMs} ms` : 'Off'}
                <ChevronRight size={13} aria-hidden />
              </span>
            </button>
            {videoPlacement && (
              <button className={row} onClick={videoPlacement.toggle}>
                <span>Video</span>
                <span className="text-muted-foreground">{videoPlacement.mini ? 'In the corner' : 'Below the play bar'}</span>
              </button>
            )}
            {onChangeSource && (
              <button
                className={row}
                onClick={() => {
                  close()
                  onChangeSource()
                }}
              >
                <span>Change source…</span>
              </button>
            )}
          </div>
        )}

        {view !== 'main' && (
          <button className={row + ' mb-1 border-b border-border !rounded-b-none font-medium'} onClick={() => setView('main')}>
            <span className="flex items-center gap-1">
              <ChevronLeft size={13} aria-hidden />
              {view === 'speed' ? 'Speed' : 'Headphone delay'}
            </span>
          </button>
        )}

        {view === 'speed' && (
          <div className="flex flex-col">
            {PRESET_RATES.map((r) => (
              <button key={r} className={row} onClick={() => onRate(r)} aria-pressed={Math.abs(r - rate) < 0.001}>
                <span>{r === 1 ? 'Normal' : formatRate(r)}</span>
                {Math.abs(r - rate) < 0.001 && <Check size={13} aria-hidden />}
              </button>
            ))}
            <div className="mt-1 border-t border-border px-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground">Custom</span>
                {custom && <span className="tabular-nums text-muted-foreground">{formatRate(rate)}</span>}
              </div>
              <label className="mt-1.5 flex items-center gap-2">
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={rate}
                  onChange={(e) => onRate(clampRate(Number(e.target.value), sourceKind))}
                  className="flex-1 accent-(--ink-primary)"
                  aria-label="Custom speed"
                />
                <input
                  className="w-14 rounded border border-border bg-card px-1 py-0.5 text-right tabular-nums text-foreground"
                  inputMode="decimal"
                  placeholder={String(rate)}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    onRate(clampRate(Number(customText), sourceKind))
                    setCustomText('')
                  }}
                  onBlur={() => {
                    if (customText.trim()) onRate(clampRate(Number(customText), sourceKind))
                    setCustomText('')
                  }}
                  aria-label="Custom speed, typed"
                />
              </label>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                {sourceKind === 'youtube'
                  ? `YouTube plays ${formatRate(range.min)} at the slowest, and always keeps the pitch. For slower, or tape-style slowing, link an audio file of the recording.`
                  : `From ${formatRate(range.min)} to ${formatRate(range.max)}. Shift+< and Shift+> step it.`}
              </p>
            </div>
            {sourceKind === 'local' && (
              <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 border-t border-border px-2 pt-2">
                <span className="flex flex-col">
                  <span className="text-foreground">Keep pitch</span>
                  <span className="leading-relaxed text-muted-foreground">
                    Off plays slowed audio lower, like tape, with sharper attacks for timing.
                  </span>
                </span>
                <Switch checked={keepPitch} onCheckedChange={setKeepPitch} aria-label="Keep pitch" />
              </label>
            )}
          </div>
        )}

        {view === 'delay' && (
          <div className="px-2 pb-1">
            <HeadphoneDelayPanel />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
