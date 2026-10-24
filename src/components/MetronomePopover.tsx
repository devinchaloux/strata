/**
 * MetronomePopover — the click track and beat matching, in the play bar.
 *
 * The switch turns on a click on every beat of the grid (lib/metronome.ts,
 * scheduled in PlayerDock), accented on downbeats, over the video or audio.
 * With a grid, the panel adjusts the grid row at the playhead while it plays:
 * tempo in steps of 0.01 or 0.1 BPM (keeping its first downbeat in place),
 * the whole row earlier or later, and "Downbeat is here", which sets the
 * tempo so the nearest downbeat lands exactly on the playhead. Each has a key,
 * listed beside it, that works whenever the click is on.
 * docs/decisions.md, "Click Track and Beat Matching".
 */
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { sortedSegments } from '@/lib/beatGrid'
import { segmentForAdjusting } from '@/lib/metronome'
import { beatMatch, type BeatMatchAction } from '@/store/beatMatch'

const step = 'rounded border border-border px-1.5 py-0.5 tabular-nums text-foreground hover:bg-accent'
const kbd = 'rounded border border-border px-1 text-[11px] text-muted-foreground'

export function MetronomePopover({ disabled }: { disabled: boolean }) {
  const clickOn = useUIStore((s) => s.clickOn)
  const setClickOn = useUIStore((s) => s.setClickOn)
  const volume = useUIStore((s) => s.clickVolume)
  const setVolume = useUIStore((s) => s.setClickVolume)
  // Re-render as the playhead crosses into another grid row.
  const segs = useDocumentStore((s) => s.document?.beatGrid)
  const duration = useDocumentStore((s) => s.document?.duration ?? 0)
  const rowId = useUIStore((s) => segmentForAdjusting(sortedSegments(segs), s.currentTime, duration)?.id ?? null)
  const row = segs?.find((g) => g.id === rowId) ?? null
  const [status, setStatus] = useState<string | null>(null)

  function run(action: BeatMatchAction) {
    const pinned = beatMatch(action)
    if (action === 'pin')
      setStatus(pinned ? `Bar line ${pinned.bars} bars in now lands here: ${pinned.bpm} BPM.` : 'Go at least a bar past the start of the grid first.')
    else setStatus(null)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title="A click on every beat of the grid, for matching it to the track"
          aria-pressed={clickOn}
          className={`flex h-7 shrink-0 items-center gap-1.5 rounded border px-2 text-xs transition-colors hover:bg-accent disabled:opacity-40 ${
            clickOn ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
          }`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${clickOn ? 'bg-primary' : 'bg-(--ink-faint)'}`}
          />
          Metronome
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 p-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-foreground">Metronome</p>
          <Switch checked={clickOn} onCheckedChange={setClickOn} aria-label="Metronome on" />
        </div>
        <p className="mt-0.5 leading-relaxed text-muted-foreground">
          Clicks on every beat of the grid while it plays, louder on the downbeat.
        </p>
        <label className="mt-2 flex items-center gap-2 text-muted-foreground">
          Volume
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="flex-1 accent-(--ink-primary)"
            aria-label="Metronome volume"
          />
        </label>

        {!row ? (
          <p className="mt-3 leading-relaxed text-muted-foreground">
            There’s no grid to click yet. Set one up from the Grid menu above the diagram, or tap{' '}
            <kbd className={kbd}>T</kbd> on the beat while it plays.
          </p>
        ) : (
          <>
            <p className="mt-3 font-medium text-foreground">Match the grid to the track</p>
            <p className="leading-relaxed text-muted-foreground">
              Line up the first beats, then listen further in. If the click pulls ahead, lower the tempo; if it lags,
              raise it.
            </p>

            <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2">
              <span className="text-muted-foreground">Tempo</span>
              <span className="flex flex-wrap items-center gap-1">
                <button className={step} onClick={() => run('tempo-coarse-down')} aria-label="Tempo down 0.1">−0.1</button>
                <button className={step} onClick={() => run('tempo-down')} aria-label="Tempo down 0.01">−0.01</button>
                <span className="min-w-16 text-center font-medium tabular-nums text-foreground">{row.bpm.toFixed(2)}</span>
                <button className={step} onClick={() => run('tempo-up')} aria-label="Tempo up 0.01">+0.01</button>
                <button className={step} onClick={() => run('tempo-coarse-up')} aria-label="Tempo up 0.1">+0.1</button>
              </span>
              <span className="whitespace-nowrap"><kbd className={kbd}>[</kbd> <kbd className={kbd}>]</kbd></span>

              <span className="text-muted-foreground">Beat</span>
              <span className="flex items-center gap-1">
                <button className={step} onClick={() => run('earlier')}>Earlier</button>
                <button className={step} onClick={() => run('later')}>Later</button>
                <span className="text-muted-foreground">5 ms</span>
              </span>
              <span className="whitespace-nowrap"><kbd className={kbd}>,</kbd> <kbd className={kbd}>.</kbd></span>

              <span className="text-muted-foreground">Exact</span>
              <span className="flex items-center gap-1">
                <button className={step} onClick={() => run('pin')}>Downbeat is here</button>
              </span>
              <span><kbd className={kbd}>D</kbd></span>
            </div>

            <p className="mt-2 leading-relaxed text-muted-foreground" role="status">
              {status ??
                'For the exact tempo, pause on a downbeat far into the track and press Downbeat is here. Shift with a key takes a bigger step.'}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
