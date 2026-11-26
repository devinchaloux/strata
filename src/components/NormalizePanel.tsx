/**
 * NormalizePanel — Normalize as a mode (lib/normalize.ts; docs/decisions.md
 * "Normalize" and "Where Controls Live"): a strip under the Segments tool row,
 * opened from Bars ▾ › Normalize…, on the selected bars or every bar.
 *
 * Steady makes the bars equal; Smooth fits a curve, with a smoothing scale
 * from light to heavy that starts at the automatic setting. While it is open,
 * dashed lines on the diagram show where each boundary would go, and the
 * panel says how far they move and how far the marks sit from the result: the
 * scatter, timing inside which can't be told from tapping. Apply moves the
 * bars, or copies them, normalized, to a layer below.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { autoLogLambda, normalizePlan, runTimes, LOG_LAMBDA_MAX, LOG_LAMBDA_MIN } from '@/lib/normalize'
import { beatsPerBarAt } from '@/lib/tempoLane'
import { segmentSpans } from '@/lib/layers'
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
    () => doc?.layers.find((l) => l.type === 'segmentation' && l.data.spans.some((s) => s.id === firstId))?.id ?? null,
    [doc, firstId],
  )

  useEffect(() => {
    setPreview(plan && layerId ? { layerId, times: plan.times } : null)
  }, [plan, layerId, setPreview])
  useEffect(() => () => setPreview(null), [setPreview])
  // A mode is left with Esc, as well as with Apply or Cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const box = 'rounded border border-border px-2 py-0.5 text-xs'
  const strip = 'flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-2 py-1.5 text-xs'
  const stripStyle = { borderColor: 'var(--hairline)', background: 'color-mix(in srgb, #d97706 8%, var(--canvas))' }
  if (!times || !plan || !doc) {
    return (
      <div className={strip} style={stripStyle} role="status">
        <span className="text-muted-foreground">Normalize works on bars that follow one another. Select a run of bars without gaps.</span>
        <button className={`${box} ml-auto text-foreground hover:bg-accent`} onClick={onClose}>
          Close
        </button>
      </div>
    )
  }
  const n = times.length - 1
  const meanBar = (times[n] - times[0]) / n
  const beats = beatsPerBarAt(doc)(times[0])
  const tooFar = mode === 'steady' && plan.maxMove > meanBar / 4
  const short = mode === 'smooth' && n < 3

  return (
    <div className={strip} style={stripStyle} role="group" aria-label={`Normalize ${n} bars`}>
      <span className="font-medium text-foreground">Normalize {n} bars</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="How to normalize">
        {(['steady', 'smooth'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`${box} ${mode === m ? 'bg-foreground font-medium text-background' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            title={m === 'steady' ? 'Make every bar the same length, at one tempo.' : 'Follow a tempo that changes, without the scatter of tapping.'}
          >
            {m === 'steady' ? 'Steady' : 'Smooth'}
          </button>
        ))}
      </div>

      {mode === 'smooth' && (
        <label className="flex items-center gap-1.5 text-muted-foreground">
          Light
          <input
            type="range"
            min={LOG_LAMBDA_MIN}
            max={LOG_LAMBDA_MAX}
            step={0.05}
            value={g}
            onChange={(e) => setLogLambda(Number(e.target.value))}
            aria-label="Smoothing, light to heavy"
            className="w-28"
          />
          Heavy
          <button
            type="button"
            disabled={logLambda === null}
            onClick={() => setLogLambda(null)}
            className="text-[11px] font-medium text-foreground underline disabled:no-underline"
            title="Smooth out tapping scatter and keep the music's own changes."
          >
            {logLambda === null ? 'Auto' : 'Back to auto'}
          </button>
        </label>
      )}

      <span
        className="min-w-0 text-[11px] leading-snug text-muted-foreground"
        role="status"
        title="Timing differences smaller than your marks' scatter can't be told apart from tapping."
      >
        {short
          ? 'Select three bars or more to use Smooth.'
          : `${mode === 'steady' ? `One tempo of ${((60 * beats) / meanBar).toFixed(1)} BPM. ` : ''}${
              plan.moved ? `This moves ${plan.moved} boundar${plan.moved === 1 ? 'y' : 'ies'} by up to ${moveText(plan.maxMove)}. ` : 'Nothing would move. '
            }${plan.moved > 0 ? `Your marks sit about ±${ms(plan.scatter)} from the result.` : ''}`}
        {tooFar && (
          <span style={{ color: 'hsl(var(--destructive))' }}> The tempo changes across these bars, so Steady moves some boundaries a long way. Use Smooth to follow the change.</span>
        )}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1 text-muted-foreground" title="Keep these bars as you marked them. The normalized bars go on a new layer below.">
          <input type="checkbox" checked={intoNew} onChange={(e) => setIntoNew(e.target.checked)} />
          Into a new layer
        </label>
        <button className={`${box} bg-card text-foreground hover:bg-accent`} onClick={onClose}>
          Cancel
        </button>
        <button
          className={`${box} border-foreground bg-foreground text-background hover:opacity-90 disabled:opacity-50`}
          disabled={short || !plan.moved}
          onClick={() => {
            normalizeBars(spans.map((s) => s.id), mode, g, intoNew)
            onClose()
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

/** Normalize's mode, under the Segments tool row while it is open (uiStore.normalizing). */
export function NormalizeMode() {
  const ids = useUIStore((s) => s.normalizing)
  const setNormalizing = useUIStore((s) => s.setNormalizing)
  const doc = useDocumentStore((s) => s.document)
  const onClose = useCallback(() => setNormalizing(null), [setNormalizing])
  if (!ids || !doc) return null
  const spans = doc.layers.flatMap((l) => segmentSpans(l).filter((s) => ids.includes(s.id)))
  return <NormalizePanel spans={spans} onClose={onClose} />
}
