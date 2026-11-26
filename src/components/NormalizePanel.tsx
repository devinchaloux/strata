/**
 * NormalizePanel — Normalize as a mode (lib/normalize.ts; docs/decisions.md
 * "Normalize" and "Where Controls Live"): a strip under the Segments tool row,
 * opened from Bars ▾ › Normalize…, on the selected bars or every bar.
 *
 * Steady makes the bars equal; Smooth fits a curve, with a smoothing scale
 * from light to heavy that starts at the automatic setting. Steady between
 * ramps, for a tempo made in a DAW, is offered only when the bars have a
 * steady stretch and a ramp (rampsOffered), and then opens selected: it fits
 * the bars to their tempo map (lib/tempoMap.ts), steady stretches and ramps
 * each at an even rate, proposed by detectTempoMap. Each corner moves a bar
 * at a time with − and +, a corner between two ramps can go (×), and a
 * ramp's rate switches its shape, percent or BPM a bar (docs/decisions.md,
 * "Steady Between Ramps" and "The Tempo Map"). While it is open,
 * dashed lines on the diagram show where each boundary would go, and the
 * panel says how far they move and how far the marks sit from the result: the
 * scatter, timing inside which can't be told from tapping. Apply moves the
 * bars, or copies them, normalized, to a layer below.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { autoLogLambda, findFlats, normalizePlan, planFrom, rampsOffered, runTimes, LOG_LAMBDA_MAX, LOG_LAMBDA_MIN, type NormalizeMode } from '@/lib/normalize'
import { detectTempoMap, fitTempoMap, rateText, type MapPiece } from '@/lib/tempoMap'
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
  // Steady between ramps: whether to offer it, and the proposed tempo map.
  const flats = useMemo(() => (times ? findFlats(times) : []), [times])
  const offered = useMemo(() => !!times && rampsOffered(times, flats, beats, TEMPO_MOVES_BPM), [times, flats, beats])
  const proposed = useMemo(() => (times && offered ? detectTempoMap(times) : []), [times, offered])
  const [chosen, setMode] = useState<NormalizeMode | null>(null)
  const mode: NormalizeMode = chosen === 'ramps' && !offered ? 'smooth' : (chosen ?? (offered ? 'ramps' : 'smooth'))
  const [movedPieces, setMovedPieces] = useState<MapPiece[] | null>(null)
  const pieces = movedPieces ?? proposed
  const [logLambda, setLogLambda] = useState<number | null>(null)
  const [intoNew, setIntoNew] = useState(false)
  const g = logLambda ?? auto
  const map = useMemo(() => (times && mode === 'ramps' && pieces.length ? fitTempoMap(times, pieces, beats) : null), [times, mode, pieces, beats])
  const plan = useMemo(
    () => (!times ? null : mode === 'ramps' ? (map ? planFrom(times, map.times) : null) : normalizePlan(times, mode, g)),
    [times, mode, g, map],
  )
  const firstId = spans[0]?.id
  const layerId = useMemo(
    () => doc?.layers.find((l) => l.type === 'segmentation' && l.data.spans.some((s) => s.id === firstId))?.id ?? null,
    [doc, firstId],
  )

  useEffect(() => {
    if (!plan || !layerId) return setPreview(null)
    const n = plan.times.length - 1
    const corners = mode === 'ramps' ? pieces.slice(0, -1).map((p) => plan.times[p.to]).filter((_, i) => i < n) : undefined
    setPreview({ layerId, times: plan.times, corners })
  }, [plan, layerId, setPreview, mode, pieces])
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
  /** Move the corner after piece `i` by a bar, each side keeping two bars. */
  const nudge = (i: number, by: number) => {
    const c = pieces[i].to + by
    if (c - pieces[i].from < 2 || pieces[i + 1].to - c < 2) return
    setMovedPieces(pieces.map((p, j) => (j === i ? { ...p, to: c } : j === i + 1 ? { ...p, from: c } : p)))
  }
  /** Take away the corner between two ramps: one ramp from the first's start to the second's end. */
  const join = (i: number) =>
    setMovedPieces([...pieces.slice(0, i), { from: pieces[i].from, to: pieces[i + 1].to, kind: 'ramp' }, ...pieces.slice(i + 2)])
  /** Switch a ramp's shape: the same percent each bar, or the same BPM. */
  const reshape = (i: number, shape: 'percent' | 'bpm') =>
    setMovedPieces(pieces.map((p, j) => (j === i ? { ...p, shape: shape === 'percent' ? 'bpm' : 'percent' } : p)))
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
                  : 'Fit the bars to their tempo map: steady stretches, and ramps each at an even rate, as a DAW tempo track has.'
            }
          >
            {m === 'steady' ? 'Steady' : m === 'smooth' ? 'Smooth' : 'Steady between ramps'}
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

      {mode === 'ramps' && map && (
        <div className="flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] tabular-nums text-muted-foreground" aria-label="Tempo map">
          {map.segments.map((seg, i) => (
            <span key={`${seg.from}-${seg.kind}`} className="flex items-center gap-1.5">
              {seg.kind === 'steady' ? (
                <span className="rounded bg-card px-1.5 py-0.5 font-medium text-foreground ring-1 ring-border">{seg.startBpm.toFixed(2)} BPM</span>
              ) : seg.kind === 'ramp' ? (
                <button
                  type="button"
                  onClick={() => reshape(i, seg.shape ?? 'percent')}
                  className="rounded bg-card px-1.5 py-0.5 text-foreground ring-1 ring-border hover:bg-accent"
                  title={`${Math.round(seg.startBpm)} to ${Math.round(seg.endBpm)} BPM. Click to change by the same ${seg.shape === 'percent' ? 'BPM' : 'percentage'} each bar.`}
                >
                  {rateText(seg)}
                </button>
              ) : (
                <span title="A bar far off its neighbours, kept as marked">as marked</span>
              )}
              {i < map.segments.length - 1 && seg.kind !== 'asMarked' && map.segments[i + 1].kind !== 'asMarked' ? (
                <span className="flex items-center gap-1">
                  <span>to</span>
                  <Corner name={barName(seg.to - 1)} label={`Corner after bar ${barName(seg.to - 1)}`} onStep={(by) => nudge(i, by)} />
                  {seg.kind === 'ramp' && map.segments[i + 1].kind === 'ramp' && (
                    <button type="button" onClick={() => join(i)} className="px-0.5 text-muted-foreground hover:text-foreground" aria-label={`Join the ramps at bar ${barName(seg.to - 1)}`} title="Join these two ramps into one">
                      ×
                    </button>
                  )}
                </span>
              ) : i < map.segments.length - 1 ? (
                <span>·</span>
              ) : null}
            </span>
          ))}
          {movedPieces && (
            <button type="button" onClick={() => setMovedPieces(null)} className="ml-2 text-[11px] font-medium text-foreground underline">
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
            normalizeBars(spans.map((s) => s.id), mode, g, intoNew, mode === 'ramps' ? pieces : undefined)
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
