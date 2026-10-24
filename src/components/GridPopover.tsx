/**
 * GridPopover — the beat grid's controls, in the diagram's top bar.
 *
 * Two states. With no grid yet, how to lay one: from the tempo and meter
 * (Document settings' values, editable here) at the first downbeat, or by
 * tapping T along with the beat. With a grid, snapping (Off / Beats / Bars,
 * remembered as the analyst's default), the grid's rows (segments) with their
 * tempo, meter, first bar and end, each editable, and, folded away, how to
 * mark a tempo change or a passage with no beat. A row's first bar left blank
 * continues the count from the one before.
 * lib/beatGrid.ts has the rules; docs/decisions.md, "Beat Grid", the reasons.
 */
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { firstBarNumbers, segmentEnd, sortedSegments, type SnapMode } from '@/lib/beatGrid'
import { formatClock } from '@/lib/youtube'
import { TimeInput } from '@/components/TimeInput'
import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { GridSegment } from '@/types/strata'

const SNAP_OPTIONS: [SnapMode, string][] = [
  ['off', 'Off'],
  ['beat', 'Beats'],
  ['bar', 'Bars'],
]

const cell = 'w-full rounded border border-border bg-card px-1 py-0.5 text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'

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

/**
 * No grid yet: lay one from the tempo (Document settings' tempo and meter,
 * editable here) at the first downbeat, or tap it in.
 */
function GridSetup() {
  const doc = useDocumentStore((s) => s.document)
  const updateMeta = useDocumentStore((s) => s.updateMeta)
  const startGridAt = useDocumentStore((s) => s.startGridAt)
  const [start, setStart] = useState(0)
  if (!doc) return null
  const ts = doc.timeSignature

  return (
    <>
      <p className="mt-3 font-medium text-foreground">Set it from the tempo</p>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        <span className="text-muted-foreground">Tempo</span>
        <span className="flex items-center gap-1">
          <span className="w-14">
            <NumberCell label="Tempo in BPM" placeholder="120" value={doc.bpm} onCommit={(v) => updateMeta({ bpm: v })} />
          </span>
          BPM
          <span className="ml-3 text-muted-foreground">Meter</span>
          <span className="w-8">
            <NumberCell
              label="Beats per bar"
              integer
              placeholder="4"
              value={ts?.numerator}
              onCommit={(v) => updateMeta({ timeSignature: v ? { numerator: v, denominator: ts?.denominator ?? 4 } : null })}
            />
          </span>
          /
          <span className="w-8">
            <NumberCell
              label="Beat unit"
              integer
              placeholder="4"
              value={ts?.denominator}
              onCommit={(v) => updateMeta({ timeSignature: v ? { numerator: ts?.numerator ?? 4, denominator: v } : null })}
            />
          </span>
        </span>
        <span className="text-muted-foreground">First downbeat</span>
        <span className="flex items-center gap-1.5">
          <TimeInput title="First downbeat" value={start} onCommit={(t) => setStart(Math.max(0, t))} />
          <button
            className="rounded border border-border px-2 py-0.5 hover:bg-accent"
            onClick={() => setStart(useUIStore.getState().currentTime)}
          >
            Use playhead
          </button>
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Pause on the first downbeat, then press Use playhead.</span>
        <button
          className="shrink-0 rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          disabled={doc.bpm == null}
          onClick={() => startGridAt(start)}
        >
          Add grid
        </button>
      </div>

      <p className="mt-4 font-medium text-foreground">Or tap it in</p>
      <p className="mt-0.5 leading-relaxed text-muted-foreground">
        While it plays, tap <kbd className="rounded border border-border px-1">T</kbd> on each beat, starting on a
        downbeat. After four taps the grid appears, and every further tap fine-tunes the tempo.
      </p>
    </>
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
  const [changesOpen, setChangesOpen] = useState(false)
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
          title="Bar and beat lines, and snapping to them"
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Grid
          {segs.length > 0 && snapMode !== 'off' && (
            <span className="rounded bg-accent px-1 text-[11px] text-foreground">snap {snapMode === 'bar' ? 'bars' : 'beats'}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-104 p-3 text-xs">
        <p className="text-[13px] font-semibold text-foreground">Beat grid</p>
        <p className="mt-0.5 leading-relaxed text-muted-foreground">
          Bar and beat lines behind the diagram, so boundaries can line up with the music.
        </p>

        {segs.length === 0 ? (
          <GridSetup />
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-medium text-foreground" title="Remembered in this browser, for every file.">
                Snap boundaries to
              </span>
              <div className="flex overflow-hidden rounded border border-border" role="radiogroup" aria-label="Snap boundaries to">
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

            <p className="mt-3 font-medium text-foreground">The grid</p>
            <p className="text-muted-foreground">Each row runs at one tempo and meter. Edit any value.</p>
            <table className="mt-1 w-full border-separate border-spacing-x-1 border-spacing-y-1">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="font-medium">From</th>
                  <th className="font-medium">BPM</th>
                  <th className="font-medium">Meter</th>
                  <th className="font-medium" title="The number of its first bar">Bar</th>
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
                        title="Remove this row of the grid"
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

            <p className="mt-1 text-muted-foreground">
              Check it by ear: turn on the Metronome in the play bar, which can fine-tune the tempo as it plays.
            </p>

            {/* Tempo changes and free passages: rarer, so folded away. */}
            <button
              type="button"
              aria-expanded={changesOpen}
              onClick={() => setChangesOpen((v) => !v)}
              className="mt-2 flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={13} className={changesOpen ? 'rotate-90 transition-transform' : 'transition-transform'} aria-hidden />
              Tempo change or a passage with no beat?
            </button>
            {changesOpen && (
              <div className="mt-1.5 space-y-2 pl-4 leading-relaxed text-muted-foreground">
                <p>
                  Press <kbd className="rounded border border-border px-1">Shift+T</kbd> where the beat stops, and tap{' '}
                  <kbd className="rounded border border-border px-1">T</kbd> again where it comes back or the tempo
                  changes. Or use the playhead:
                </p>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent" onClick={() => startGridAt(now())}>
                    New row at playhead
                  </button>
                  <button className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent" onClick={() => endGridAt(now())}>
                    Stop the grid at playhead
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
