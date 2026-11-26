/**
 * NormalizePanel — Normalize as a mode (lib/normalize.ts; docs/decisions.md
 * "Normalize" and "Where Controls Live"): a strip under the Segments tool row,
 * opened from Bars ▾ › Normalize…, on the selected bars or every bar.
 *
 * Steady makes the bars equal; Smooth fits a curve, with a smoothing scale
 * from light to heavy that starts at the automatic setting. Steady between
 * ramps, for a tempo made in a DAW, is offered only when the bars have a
 * steady stretch and a ramp (rampsOffered), and then opens selected: each
 * stretch at one tempo, its corners proposed (findFlats) and moved a bar at a
 * time with − and +, the ramps smoothed between (docs/decisions.md, "Steady
 * Between Ramps"). While it is open,
 * dashed lines on the diagram show where each boundary would go, and the
 * panel says how far they move and how far the marks sit from the result: the
 * scatter, timing inside which can't be told from tapping. Apply moves the
 * bars, or copies them, normalized, to a layer below.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import {
  autoLogLambda,
  findFlats,
  flatBpmOf,
  normalizePlan,
  rampsOffered,
  runTimes,
  settleFlats,
  LOG_LAMBDA_MAX,
  LOG_LAMBDA_MIN,
  type Flat,
  type NormalizeMode,
} from '@/lib/normalize'
import { beatsPerBarAt, TEMPO_MOVES_BPM } from '@/lib/tempoLane'
import { segmentSpans } from '@/lib/layers'
import type { Span } from '@/types/strata'

const ms = (s: number) => `${Math.round(s * 1000)} ms`
const moveText = (s: number) => (s >= 1 ? `${s.toFixed(1)} s` : ms(s))

export function NormalizePanel({ spans, onClose }: { spans: Span[]; onClose: () => void }) {
  const doc = useDocumentStore((s) => s.document)
  const normalizeBars = useDocumentStore((s) => s.normalizeBars)
  const setPreview = useUIStore((s) => s.setNormalizePreview)
  const showToast = useUIStore((s) => s.showToast)
  // Keyed on the times themselves: the Inspector hands over a fresh array of
  // spans on every render, and the preview must not be set again for nothing.
  const timesKey = JSON.stringify(runTimes(spans))
  const times = useMemo(() => JSON.parse(timesKey) as number[] | null, [timesKey])
  const auto = useMemo(() => (times ? autoLogLambda(times) : 0), [times])
  const beats = useMemo(() => (doc && times ? beatsPerBarAt(doc)(times[0]) : 4), [doc, times])
  // Steady between ramps: proposed corners, and whether to offer it at all.
  const proposed = useMemo(() => (times ? findFlats(times) : []), [times])
  const offered = useMemo(() => !!times && rampsOffered(times, proposed, beats, TEMPO_MOVES_BPM), [times, proposed, beats])
  const [chosen, setMode] = useState<NormalizeMode | null>(null)
  const mode: NormalizeMode = chosen === 'ramps' && !offered ? 'smooth' : (chosen ?? (offered ? 'ramps' : 'smooth'))
  const [movedFlats, setMovedFlats] = useState<Flat[] | null>(null)
  const flats = movedFlats ?? proposed
  const [logLambda, setLogLambda] = useState<number | null>(null)
  const [intoNew, setIntoNew] = useState(false)
  const g = logLambda ?? auto
  const plan = useMemo(
    () => (times ? normalizePlan(times, mode, g, mode === 'ramps' ? flats : undefined) : null),
    [times, mode, g, flats],
  )
  const firstId = spans[0]?.id
  const layerId = useMemo(
    () => doc?.layers.find((l) => l.type === 'segmentation' && l.data.spans.some((s) => s.id === firstId))?.id ?? null,
    [doc, firstId],
  )

  useEffect(() => {
    if (!plan || !layerId) return setPreview(null)
    const n = plan.times.length - 1
    const corners =
      mode === 'ramps' ? flats.flatMap((f) => [f.from > 0 ? plan.times[f.from] : null, f.to < n ? plan.times[f.to] : null]).filter((t): t is number => t != null) : undefined
    setPreview({ layerId, times: plan.times, corners })
  }, [plan, layerId, setPreview, mode, flats])
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
  // A bar's name: its label (the bar number, on a bar layer), else its place in the run.
  const ordered = [...spans].sort((a, b) => a.startTime - b.startTime)
  const barName = (k: number) => ordered[k]?.label?.trim() || String(k + 1)
  /** Move one corner of stretch `i` by a bar, keeping each stretch at least four bars. */
  const nudge = (i: number, end: 'from' | 'to', by: number) => {
    const next = flats.map((f, j) => (j === i ? { ...f, [end]: f[end] + by } : f))
    const f = next[i]
    if (f.to - f.from < 4 || f.from < 0 || f.to > n) return
    setMovedFlats(settleFlats(next, n))
  }
  const tooFar = mode === 'steady' && plan.maxMove > meanBar / 4
  const short = mode === 'smooth' && n < 3

  return (
    <div className={strip} style={stripStyle} role="group" aria-label={`Normalize ${n} bars`}>
      <span className="font-medium text-foreground">Normalize</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="How to normalize">
        {(offered ? (['steady', 'smooth', 'ramps'] as const) : (['steady', 'smooth'] as const)).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`${box} ${mode === m ? 'bg-foreground font-medium text-background' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            title={
              m === 'steady'
                ? 'Make every bar the same length, at one tempo.'
                : m === 'smooth'
                  ? 'Follow a tempo that changes, without the scatter of tapping.'
                  : 'Put each steady stretch at one tempo, with smooth ramps between, as a DAW tempo track has.'
            }
          >
            {m === 'steady' ? 'Steady' : m === 'smooth' ? 'Smooth' : 'Steady between ramps'}
          </button>
        ))}
      </div>

      {mode !== 'steady' && (
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

      {/* Figures, not a sentence ("Menus Are Names"); the scatter's meaning is on hover. */}
      <span className="min-w-0 text-[11.5px] tabular-nums text-muted-foreground" role="status">
        {short ? (
          'Select three bars or more for Smooth.'
        ) : (
          <>
            {mode === 'steady' && <span className="text-foreground">{((60 * beats) / meanBar).toFixed(1)} BPM · </span>}
            {plan.moved ? `${plan.moved} moved · ≤ ${moveText(plan.maxMove)} · ` : 'Nothing to move'}
            {plan.moved > 0 && (
              <span title="How far your marks sit from the result. Timing closer than this can't be told from tapping." className="cursor-help underline decoration-dotted underline-offset-2">
                ±{ms(plan.scatter)} scatter
              </span>
            )}
          </>
        )}
        {tooFar && <span style={{ color: 'hsl(var(--destructive))' }}> · Steady moves some bars far. Try Smooth.</span>}
      </span>

      {mode === 'ramps' && (
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] tabular-nums text-muted-foreground" aria-label="Steady stretches">
          {flats.map((f, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="font-medium text-foreground">{flatBpmOf(times, f, beats).toFixed(2)} BPM</span>
              <span>from bar</span>
              <Corner name={barName(f.from)} label={`Steady from bar ${barName(f.from)}`} onStep={(by) => nudge(i, 'from', by)} />
              <span>to bar</span>
              <Corner name={barName(f.to - 1)} label={`Steady to bar ${barName(f.to - 1)}`} onStep={(by) => nudge(i, 'to', by)} />
            </span>
          ))}
          {movedFlats && (
            <button type="button" onClick={() => setMovedFlats(null)} className="text-[11px] font-medium text-foreground underline">
              Back to proposed
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1 text-muted-foreground" title="Keep these bars as you marked them. The normalized bars go on a new layer below.">
          <input type="checkbox" checked={intoNew} onChange={(e) => setIntoNew(e.target.checked)} />
          New layer
        </label>
        <button className={`${box} bg-card text-foreground hover:bg-accent`} onClick={onClose}>
          Cancel
        </button>
        <button
          className={`${box} border-foreground bg-foreground text-background hover:opacity-90 disabled:opacity-50`}
          disabled={short || !plan.moved}
          onClick={() => {
            normalizeBars(spans.map((s) => s.id), mode, g, intoNew, mode === 'ramps' ? flats : undefined)
            showToast(`Normalized ${n} bars${intoNew ? ' into a new layer' : ''}`)
            onClose()
          }}
        >
          Apply to {n} bars
        </button>
      </div>
    </div>
  )
}

/** A corner of a steady stretch: its bar, with − and + to move it a bar earlier or later. */
function Corner({ name, label, onStep }: { name: string; label: string; onStep: (by: number) => void }) {
  const step = 'h-5 w-5 rounded border border-border bg-card text-foreground hover:bg-accent'
  return (
    <span className="flex items-center gap-0.5" role="group" aria-label={label}>
      <button type="button" className={step} onClick={() => onStep(-1)} aria-label="A bar earlier">
        −
      </button>
      <span className="min-w-[2ch] text-center font-medium text-foreground">{name}</span>
      <button type="button" className={step} onClick={() => onStep(1)} aria-label="A bar later">
        +
      </button>
    </span>
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
