/**
 * NormalizePanel — Normalize for a run of selected bars (lib/normalize.ts,
 * docs/decisions.md "Normalize"), opened from the Inspector's Bars row.
 *
 * Steady makes the bars equal; Smooth fits a curve, with a smoothing scale
 * from light to heavy that starts at the automatic setting. While it is open,
 * dashed lines on the diagram show where each boundary would go, and the
 * panel says how far they move and how far the marks sit from the result: the
 * scatter, timing inside which can't be told from tapping. Apply moves the
 * bars, or copies them, normalized, to a layer below.
 */
import { useEffect, useMemo, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { autoLogLambda, normalizePlan, runTimes, LOG_LAMBDA_MAX, LOG_LAMBDA_MIN } from '@/lib/normalize'
import { beatsPerBarAt } from '@/lib/tempoLane'
import type { Span } from '@/types/strata'

const ms = (s: number) => `${Math.round(s * 1000)} ms`
const moveText = (s: number) => (s >= 1 ? `${s.toFixed(1)} s` : ms(s))

export function NormalizePanel({ spans, onClose }: { spans: Span[]; onClose: () => void }) {
  const doc = useDocumentStore((s) => s.document)
  const normalizeBars = useDocumentStore((s) => s.normalizeBars)
  const setPreview = useUIStore((s) => s.setNormalizePreview)
  // Keyed on the times themselves: the Inspector hands over a fresh array of
  // spans on every render, and the preview must not be set again for nothing.
  const timesKey = JSON.stringify(runTimes(spans))
  const times = useMemo(() => JSON.parse(timesKey) as number[] | null, [timesKey])
  const auto = useMemo(() => (times ? autoLogLambda(times) : 0), [times])
  const [mode, setMode] = useState<'steady' | 'smooth'>('smooth')
  const [logLambda, setLogLambda] = useState<number | null>(null)
  const [intoNew, setIntoNew] = useState(false)
  const g = logLambda ?? auto
  const plan = useMemo(() => (times ? normalizePlan(times, mode, g) : null), [times, mode, g])
  const firstId = spans[0]?.id
  const layerId = useMemo(
    () => doc?.layers.find((l) => l.type === 'form-diagram' && l.data.spans.some((s) => s.id === firstId))?.id ?? null,
    [doc, firstId],
  )

  useEffect(() => {
    setPreview(plan && layerId ? { layerId, times: plan.times } : null)
  }, [plan, layerId, setPreview])
  useEffect(() => () => setPreview(null), [setPreview])

  const box = 'rounded border border-border px-2 py-0.5 text-xs'
  if (!times || !plan || !doc) {
    return <p className="pl-[2.875rem] text-[11px] text-muted-foreground">Normalize works on bars that follow one another.</p>
  }
  const n = times.length - 1
  const meanBar = (times[n] - times[0]) / n
  const beats = beatsPerBarAt(doc)(times[0])
  const tooFar = mode === 'steady' && plan.maxMove > meanBar / 4
  const short = mode === 'smooth' && n < 3

  return (
    <div className="ml-[2.875rem] flex flex-col gap-2 rounded border border-border p-2 text-xs">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="How to normalize">
        {(['steady', 'smooth'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`${box} ${mode === m ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            title={m === 'steady' ? 'Every bar the same length: one tempo across these bars' : 'A smooth curve that follows a tempo that moves, without the scatter of tapping'}
          >
            {m === 'steady' ? 'Steady' : 'Smooth'}
          </button>
        ))}
      </div>

      {mode === 'smooth' && (
        <label className="flex flex-col gap-0.5">
          <span className="flex items-center justify-between text-muted-foreground">
            <span>Smoothing</span>
            <button
              type="button"
              disabled={logLambda === null}
              onClick={() => setLogLambda(null)}
              className="text-[11px] underline disabled:no-underline disabled:opacity-60"
              title="The smoothest setting at which what is left still looks like tapping scatter"
            >
              {logLambda === null ? 'Auto' : 'Back to auto'}
            </button>
          </span>
          <input
            type="range"
            min={LOG_LAMBDA_MIN}
            max={LOG_LAMBDA_MAX}
            step={0.05}
            value={g}
            onChange={(e) => setLogLambda(Number(e.target.value))}
            aria-label="Smoothing, light to heavy"
          />
          <span className="flex justify-between text-[11px] text-muted-foreground">
            <span>Light: keeps more detail</span>
            <span>Heavy</span>
          </span>
        </label>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground" role="status">
        {short
          ? 'Smooth needs three bars or more.'
          : mode === 'steady'
            ? `One tempo, ${((60 * beats) / meanBar).toFixed(1)} BPM. `
            : ''}
        {!short &&
          (plan.moved
            ? `Moves ${plan.moved} boundar${plan.moved === 1 ? 'y' : 'ies'}, at most ${moveText(plan.maxMove)}. `
            : 'Nothing moves. ')}
        {!short &&
          plan.moved > 0 &&
          `Your marks sit about ±${ms(plan.scatter)} from this; timing within that can't be told apart from tapping.`}
      </p>
      {tooFar && (
        <p className="text-[11px] leading-snug" style={{ color: 'hsl(var(--destructive))' }}>
          The tempo moves across these bars, so Steady shifts some a long way. Smooth follows it.
        </p>
      )}

      <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground" title="Keep these bars as you marked them and put the normalized ones on a layer below">
        <input type="checkbox" checked={intoNew} onChange={(e) => setIntoNew(e.target.checked)} />
        Into a new layer, keeping these as marked
      </label>

      <div className="flex gap-1.5">
        <button
          className={`${box} bg-foreground text-background hover:opacity-90 disabled:opacity-50`}
          disabled={short || !plan.moved}
          onClick={() => {
            normalizeBars(spans.map((s) => s.id), mode, g, intoNew)
            onClose()
          }}
        >
          Apply
        </button>
        <button className={`${box} text-foreground hover:bg-accent`} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
