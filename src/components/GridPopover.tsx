/**
 * GridPopover — the beat grid's controls, in the diagram's top bar.
 *
 * Snapping (Off / Beats / Bars, remembered as the analyst's default), how to
 * lay the grid down by ear (T to tap along, Shift+T to stop) or by hand (start
 * at 0:00 or the playhead, then type the values), and the list of
 * segments with their tempo, meter, first bar and end, each editable. A
 * segment's first bar left blank continues the count from the one before.
 * lib/beatGrid.ts has the rules; docs/decisions.md, "Beat Grid", the reasons.
 */
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { firstBarNumbers, segmentEnd, sortedSegments, type SnapMode } from '@/lib/beatGrid'
import { formatClock } from '@/lib/youtube'
import { TimeInput } from '@/components/TimeInput'
import { X } from 'lucide-react'
import type { GridSegment } from '@/types/strata'

const SNAP_OPTIONS: [SnapMode, string][] = [
  ['off', 'Off'],
  ['beat', 'Beats'],
  ['bar', 'Bars'],
]

const cell = 'w-full rounded border border-border bg-card px-1 py-0.5 text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

/** A number field that commits on blur or Enter; blank commits null. */
function NumberCell({
  value,
  placeholder,
  label,
  integer,
  onCommit,
}: {
  value: number | null | undefined
  placeholder?: string
  label: string
  integer?: boolean
  onCommit: (v: number | null) => void
}) {
  return (
    <input
      // Re-mount on an outside change (tap tempo, undo) so the field shows it.
      key={String(value)}
      aria-label={label}
      className={cell}
      defaultValue={value ?? ''}
      placeholder={placeholder}
      inputMode="decimal"
      onBlur={(e) => {
        const raw = e.target.value.trim()
        if (raw === '') return onCommit(null)
        const n = Number(raw)
        if (Number.isFinite(n) && n > 0 && (!integer || Number.isInteger(n))) onCommit(n)
        else e.target.value = value == null ? '' : String(value)
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

export function GridPopover() {
  const doc = useDocumentStore((s) => s.document)
  const startGridAt = useDocumentStore((s) => s.startGridAt)
  const endGridAt = useDocumentStore((s) => s.endGridAt)
  const updateGridSegment = useDocumentStore((s) => s.updateGridSegment)
  const removeGridSegment = useDocumentStore((s) => s.removeGridSegment)
  const snapMode = useUIStore((s) => s.snapMode)
  const setSnapMode = useUIStore((s) => s.setSnapMode)
  if (!doc) return null

  const segs = sortedSegments(doc.beatGrid)
  const firsts = firstBarNumbers(segs, doc.duration)
  const now = () => useUIStore.getState().currentTime
  const update = (g: GridSegment, patch: Partial<Omit<GridSegment, 'id'>>) => updateGridSegment(g.id, patch)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Beat grid and snapping"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Grid
          {snapMode !== 'off' && (
            <span className="rounded bg-accent px-1 text-[11px] text-foreground">snap {snapMode === 'bar' ? 'bars' : 'beats'}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[26rem] p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-foreground" title="Your choice is remembered in this browser for every file.">
            Snap to the grid
          </span>
          <div className="flex overflow-hidden rounded border border-border" role="radiogroup" aria-label="Snap to the grid">
            {SNAP_OPTIONS.map(([mode, label]) => (
              <button
                key={mode}
                role="radio"
                aria-checked={snapMode === mode}
                onClick={() => setSnapMode(mode)}
                className={snapMode === mode ? 'bg-accent px-2 py-0.5 font-medium text-foreground' : 'px-2 py-0.5 text-muted-foreground hover:bg-accent/60'}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 leading-relaxed text-muted-foreground">
          While it plays, tap <kbd className="rounded border border-border px-1">T</kbd> on each beat, starting on a
          downbeat. After four taps the grid appears at the tempo you tapped (to the nearest BPM; type a decimal
          below if you need one), reaching back to the last section boundary before your taps. Press{' '}
          <kbd className="rounded border border-border px-1">Shift+T</kbd> where it stops for a free passage, and tap
          again where the beat comes back.
        </p>

        {/* By hand, for when tapping isn't practical: start a segment, then
            type its tempo and meter in the table. */}
        <p className="mt-3 font-medium text-foreground">Or set it by hand</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            className="rounded border border-border px-2 py-0.5 hover:bg-accent disabled:opacity-40"
            disabled={segs.some((g) => g.start < 0.05)}
            onClick={() => startGridAt(0)}
          >
            Start at 0:00
          </button>
          <button className="rounded border border-border px-2 py-0.5 hover:bg-accent" onClick={() => startGridAt(now())}>
            Start at playhead
          </button>
          <button
            className="rounded border border-border px-2 py-0.5 hover:bg-accent disabled:opacity-40"
            disabled={!segs.length}
            onClick={() => endGridAt(now())}
          >
            Stop at playhead
          </button>
        </div>
        <p className="mt-1 text-muted-foreground">Then type the tempo, meter and first bar below; every value is editable.</p>

        {segs.length > 0 && (
          <table className="mt-3 w-full border-separate border-spacing-x-1 border-spacing-y-1">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="font-medium">From</th>
                <th className="font-medium">BPM</th>
                <th className="font-medium">Meter</th>
                <th className="font-medium">Bar</th>
                <th className="font-medium">To</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {segs.map((g, i) => (
                <tr key={g.id}>
                  <td className="w-24">
                    {/* Editable: a tapped grid reaches back to where the music
                        seems to start, which the analyst may want to trim. */}
                    <TimeInput title="Where this stretch of grid starts (a downbeat)" value={g.start} onCommit={(t) => update(g, { start: Math.max(0, t) })} />
                  </td>
                  <td className="w-16">
                    <NumberCell label="Tempo in BPM" value={g.bpm} onCommit={(v) => v && update(g, { bpm: v })} />
                  </td>
                  <td className="w-20">
                    <div className="flex items-center gap-0.5">
                      <NumberCell label="Beats per bar" integer value={g.beatsPerBar} onCommit={(v) => v && update(g, { beatsPerBar: v })} />
                      <span className="text-muted-foreground">/</span>
                      <NumberCell label="Beat unit" integer value={g.beatUnit ?? 4} onCommit={(v) => update(g, { beatUnit: v ?? undefined })} />
                    </div>
                  </td>
                  <td className="w-14">
                    <NumberCell
                      label="First bar number (blank continues the count)"
                      integer
                      value={g.firstBar}
                      placeholder={String(firsts[i])}
                      onCommit={(v) => update(g, { firstBar: v })}
                    />
                  </td>
                  <td className="tabular-nums text-muted-foreground">{formatClock(segmentEnd(segs, i, doc.duration))}</td>
                  <td>
                    <button
                      aria-label={`Remove the grid from ${formatClock(g.start)}`}
                      title="Remove this segment"
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => removeGridSegment(g.id)}
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PopoverContent>
    </Popover>
  )
}
