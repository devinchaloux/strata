/**
 * The Tempo block's tool row menus (widgets/tempo.md §3a; docs/decisions.md,
 * "Where Controls Live", "Menus Are Names" and "Tempo Gets a Tool Row"):
 * View ▾ (what to draw, and the smoothing) and Scale ▾. Each acts on one
 * tempo layer, named in its header; with several, the header chooses which.
 * Rows are names, with one hint line at the foot that follows the row under
 * the pointer or keyboard focus. These are drawing choices, saved in the file:
 * no bar moves.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LOG_LAMBDA_MAX, LOG_LAMBDA_MIN } from '@/lib/normalize'
import { MENU_TRIGGER } from '@/lib/toolRow'
import type { TempoLayer } from '@/types/strata'

type Show = 'marked' | 'smoothed' | 'deviation' | 'map'

const VIEWS: Array<[Show, string, string]> = [
  ['marked', 'As marked', 'Each bar’s tempo as you marked it.'],
  ['smoothed', 'Smoothed', 'A smooth curve through the tempo. No bar moves.'],
  ['deviation', 'Deviation', 'How far each boundary sits from the smooth curve, in ms. The shaded band is your tapping scatter.'],
  ['map', 'Tempo map', 'Steady stretches and even ramps, as a DAW tempo track, each with its tempo or rate. No bar moves.'],
]

const box = 'rounded border border-border bg-(--guide-faint) px-1.5 py-0.5 text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'
const rowClass = 'flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-foreground hover:bg-accent focus-within:bg-accent'

/** The line at the foot of a menu: one sentence, about one thing. */
function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="-mx-1.5 -mb-1.5 mt-1 min-h-[2rem] rounded-b-md border-t border-border bg-(--guide-faint) px-3 py-2 text-[12px] leading-snug text-muted-foreground" aria-live="polite">
      {children}
    </p>
  )
}

/** A menu over one of the block's tempo layers: its chip, its header (choosing the layer when there are several) and its hint line. */
function TempoMenu({
  name,
  title,
  layers,
  idle,
  children,
}: {
  name: string
  title: string
  layers: TempoLayer[]
  /** The hint with nothing highlighted. */
  idle: string
  children: (layer: TempoLayer, setHint: (hint: string | null) => void) => ReactNode
}) {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const layer = layers.find((l) => l.id === targetId) ?? layers[0]
  return (
    <Popover onOpenChange={(o) => !o && setHint(null)}>
      <PopoverTrigger asChild>
        <button type="button" className={MENU_TRIGGER} title={title}>
          {name}
          <ChevronDown size={11} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5" onMouseLeave={() => setHint(null)}>
        <div className="flex items-baseline justify-between gap-2 px-2.5 pb-1 pt-1.5 text-[11.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">{name}</span>
          {layers.length > 1 ? (
            <select value={layer.id} onChange={(e) => setTargetId(e.target.value)} aria-label="Tempo layer" className="max-w-[9rem] truncate rounded border border-border bg-transparent px-1 text-[11.5px]">
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate">{layer.label}</span>
          )}
        </div>
        {children(layer, setHint)}
        <Hint>{hint ?? idle}</Hint>
      </PopoverContent>
    </Popover>
  )
}

/** View ▾: which of marked, smoothed and deviation to draw, and how smooth. */
export function TempoViewMenu({ layers }: { layers: TempoLayer[] }) {
  const setDisplay = useDocumentStore((s) => s.setTempoDisplay)
  return (
    <TempoMenu name="View" title="What the tempo shows: as marked, smoothed, deviation." layers={layers} idle="Drawing only: no bar moves.">
      {(layer, setHint) => {
        const display = layer.data.display ?? {}
        const show = display.show ?? ['marked']
        const toggle = (v: Show, on: boolean) => {
          const next = on ? [...new Set([...show, v])] : show.filter((x) => x !== v)
          setDisplay(layer.id, { show: next.length ? VIEWS.map(([x]) => x).filter((x) => next.includes(x)) : ['marked'] })
        }
        const smoothing = show.includes('smoothed') || show.includes('deviation')
        const about = (text: string) => ({ onMouseEnter: () => setHint(text), onFocus: () => setHint(text) })
        return (
          <div className="flex flex-col">
            {VIEWS.map(([v, name, what]) => (
              <label key={v} className={rowClass} {...about(what)}>
                <input type="checkbox" checked={show.includes(v)} onChange={(e) => toggle(v, e.target.checked)} />
                {name}
              </label>
            ))}
            <div className="my-1 border-t border-border" />
            <div
              className="flex flex-col gap-1 px-2.5 py-1.5"
              {...about(smoothing ? 'How smooth the curve is. Auto: the smoothest that leaves only tapping scatter.' : 'Show Smoothed or Deviation to set it.')}
            >
              <span className={`flex items-center justify-between text-[13px] ${smoothing ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                Smoothing
                <button
                  type="button"
                  className="text-[11.5px] text-muted-foreground underline disabled:no-underline disabled:opacity-60"
                  disabled={!smoothing || display.smoothing == null}
                  onClick={() => setDisplay(layer.id, { smoothing: undefined })}
                >
                  {display.smoothing == null ? 'Auto' : 'Back to auto'}
                </button>
              </span>
              <input
                type="range"
                min={LOG_LAMBDA_MIN}
                max={LOG_LAMBDA_MAX}
                step={0.05}
                disabled={!smoothing}
                value={display.smoothing ?? 1}
                onChange={(e) => setDisplay(layer.id, { smoothing: Number(e.target.value) })}
                aria-label="Smoothing, light to heavy"
              />
            </div>
          </div>
        )
      }}
    </TempoMenu>
  )
}

/** Scale ▾: the BPM range, from the data or fixed. */
export function TempoScaleMenu({ layers }: { layers: TempoLayer[] }) {
  const setDisplay = useDocumentStore((s) => s.setTempoDisplay)
  return (
    <TempoMenu name="Scale" title="The tempo range drawn: from the data, or fixed." layers={layers} idle="A fixed range compares recordings on one scale.">
      {(layer, setHint) => {
        const scale = layer.data.display?.scale ?? null
        const about = (text: string) => ({ onMouseEnter: () => setHint(text), onFocus: () => setHint(text) })
        return (
          <div className="flex flex-col">
            <label className={rowClass} {...about('From the lowest tempo to the highest, out to the nearest 10.')}>
              <input type="radio" checked={!scale} onChange={() => setDisplay(layer.id, { scale: undefined })} />
              From the data
            </label>
            <label className={rowClass} {...about('The same range whatever the bars, to compare recordings.')}>
              <input type="radio" checked={!!scale} onChange={() => setDisplay(layer.id, { scale: scale ?? { min: 40, max: 200 } })} />
              Fixed
            </label>
            {scale && (
              <span className="flex items-center gap-1 px-2.5 pb-1.5 pl-8 text-xs text-muted-foreground">
                <input
                  type="number"
                  className={`${box} w-14`}
                  value={scale.min}
                  aria-label="Lowest tempo"
                  onChange={(e) => setDisplay(layer.id, { scale: { min: Number(e.target.value) || 0, max: scale.max } })}
                />
                –
                <input
                  type="number"
                  className={`${box} w-14`}
                  value={scale.max}
                  aria-label="Highest tempo"
                  onChange={(e) => setDisplay(layer.id, { scale: { min: scale.min, max: Number(e.target.value) || 0 } })}
                />
                BPM
              </span>
            )}
          </div>
        )
      }}
    </TempoMenu>
  )
}
