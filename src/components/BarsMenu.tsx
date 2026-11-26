/**
 * BarsMenu — Segments' Bars ▾ menu: every bar tool in one place (docs/decisions.md,
 * "Where Controls Live", "Menus Are Names" and "The Bars Menu Waits for the Bar
 * Layer"). It shows only once a layer is the bar layer, switched on in that
 * layer's ⋯ menu; nothing in it makes one.
 *
 * A row is a name. The header says once what the tools act on: the selected
 * bars of the bar layer, or all of them. One hint line at the foot follows the
 * row under the pointer or the keyboard focus, and says what it does, or, for
 * a row that can't act yet, what to do first. A row that asks first ends in
 * "…" and opens a short form whose button names the outcome ("Count 198
 * bars"). What a row changes shows on the diagram, with a toast and Undo.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore, groupBoundaryOnBar } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { countOf } from '@/lib/hypermeter'
import { segmentSpans } from '@/lib/layers'
import { MENU_TRIGGER } from '@/lib/toolRow'
import type { Layer, Span } from '@/types/strata'

type View = 'list' | 'number' | 'count' | 'split'

const GROUPS = 'groups'
const box =
  'rounded border border-border bg-(--guide-faint) px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'
const primary = 'rounded bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90'

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/** The line at the foot of the menu or form: one sentence, about one thing. */
function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="-mx-1.5 -mb-1.5 mt-1 min-h-[2rem] rounded-b-md border-t border-border bg-(--guide-faint) px-3 py-2 text-[12px] leading-snug text-muted-foreground" aria-live="polite">
      {children}
    </p>
  )
}

export function BarsMenu() {
  const doc = useDocumentStore((s) => s.document)
  const numberBarLayer = useDocumentStore((s) => s.numberBarLayer)
  const countBars = useDocumentStore((s) => s.countBars)
  const elideSpan = useDocumentStore((s) => s.elideSpan)
  const elideGroupBoundary = useDocumentStore((s) => s.elideGroupBoundary)
  const phrasesFromCount = useDocumentStore((s) => s.phrasesFromCount)
  const gridFromBars = useDocumentStore((s) => s.gridFromBars)
  const splitIntoBars = useDocumentStore((s) => s.splitIntoBars)
  const numberBars = useDocumentStore((s) => s.numberBars)
  const selectedIds = useUIStore((s) => s.selectedSpanIds)
  const barGroup = useUIStore((s) => s.barGroup)
  const setBarGroup = useUIStore((s) => s.setBarGroup)
  const setNormalizing = useUIStore((s) => s.setNormalizing)
  const setTempoOffer = useUIStore((s) => s.setTempoOffer)
  const showToast = useUIStore((s) => s.showToast)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('list')
  const [hint, setHint] = useState<string | null>(null)
  const [first, setFirst] = useState<number | null>(null)
  const [by, setBy] = useState<string | null>(null)
  const barLayer = doc?.layers.find((l): l is Layer => l.role === 'bars' && l.type === 'segmentation')
  if (!doc || !barLayer) return null

  const allBars = [...segmentSpans(barLayer)].sort((a, b) => a.startTime - b.startTime)
  const selectedBars = allBars.filter((s) => selectedIds.includes(s.id))
  // What a tool acts on: the selected bars, or every bar when none are selected.
  const bars: Span[] = selectedBars.length ? selectedBars : allBars
  const ids = bars.map((s) => s.id)
  const n = bars.length
  const one = selectedBars.length === 1 ? selectedBars[0] : null
  // Spans selected on another layer: phrases to split into bars.
  const otherSelected = doc.layers
    .filter((l) => l.type === 'segmentation' && l.id !== barLayer.id)
    .flatMap((l) => segmentSpans(l).filter((s) => selectedIds.includes(s.id)))
  const hasGrid = (doc.beatGrid?.length ?? 0) > 0
  const above = doc.layers
    .filter((l) => l.type === 'segmentation' && l.displayOrder > barLayer.displayOrder && segmentSpans(l).length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const byLayer = by === GROUPS ? null : (above.find((l) => l.id === by) ?? (by === null ? above[0] : undefined) ?? null)
  const firstNumber = first ?? (Number.isInteger(Number(bars[0]?.label)) ? Number(bars[0]?.label) : 1)
  // An empty bar layer: the rows that act on bars wait for some.
  const none = !allBars.length && 'Fill from grid or split phrases first.'
  const counted = bars.some((s) => countOf(s.annotation) !== null)
  const elided = one && (one.annotation ?? '').includes('=') ? groupBoundaryOnBar(doc, barLayer.id, one.id) : null
  const offer = elided && elided.boundary.before.endBoundaryType !== 'elided' ? elided : null

  // Closing from code skips onOpenChange, so it resets the view itself: the
  // menu always opens on its list.
  const close = () => {
    setOpen(false)
    setView('list')
    setHint(null)
  }
  // A form starts with its own hint, not the last row's.
  const go = (v: View) => {
    setHint(null)
    setView(v)
  }
  const back = () => go('list')

  /** One row: a name, its hint on hover or focus, and its reason instead when it can't act. */
  const row = (name: string, what: string, act: () => void, reason?: string | false) => (
    <button
      key={name}
      type="button"
      aria-disabled={!!reason || undefined}
      onMouseEnter={() => setHint(reason || what)}
      onFocus={() => setHint(reason || what)}
      onClick={() => {
        if (reason) return setHint(reason)
        act()
      }}
      className={`w-full rounded px-2.5 py-1.5 text-left text-[13px] ${reason ? 'cursor-default text-muted-foreground/60' : 'text-foreground hover:bg-accent focus-visible:bg-accent'} focus-visible:outline-hidden`}
    >
      {name}
    </button>
  )

  const groupSize = (
    <input
      type="number"
      min={1}
      max={16}
      value={barGroup}
      onChange={(e) => setBarGroup(Number(e.target.value) || 1)}
      aria-label="Bars in a group"
      className={`w-12 ${box}`}
    />
  )
  const formHead = (
    <button type="button" onClick={back} className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground">
      <ChevronLeft size={12} aria-hidden /> Bars
    </button>
  )

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setView('list')
          setHint(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={MENU_TRIGGER} title="Number, count, elide, and normalize bars.">
          Bars
          {selectedBars.length > 0 && (
            <span className="rounded bg-accent px-1 text-[11px] text-foreground">{selectedBars.length}</span>
          )}
          <ChevronDown size={11} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5" onMouseLeave={() => setHint(null)}>
        {view === 'number' && (
          <div className="flex flex-col gap-2.5 p-1.5">
            {formHead}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              From bar
              <input
                type="number"
                min={0}
                value={firstNumber}
                onChange={(e) => setFirst(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                aria-label="First bar number"
                className={`w-16 ${box}`}
              />
            </label>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                numberBarLayer(barLayer.id, firstNumber, ids)
                showToast(`Numbered ${plural(n, 'bar')}`)
                close()
              }}
            >
              Number {plural(n, 'bar')}
            </button>
            <Hint>Use 0 for a pickup.</Hint>
          </div>
        )}

        {view === 'count' && (
          <div className="flex flex-col gap-2.5 p-1.5">
            {formHead}
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Group by
              <select
                value={byLayer ? byLayer.id : GROUPS}
                onChange={(e) => setBy(e.target.value)}
                className="rounded border border-border bg-(--guide-faint) px-1 py-0.5 text-xs text-foreground"
              >
                {above.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
                <option value={GROUPS}>A set size</option>
              </select>
              {!byLayer && groupSize}
            </label>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                const r = countBars(barLayer.id, byLayer?.id ?? null, barGroup, ids)
                showToast(r.skipped ? `Counted ${plural(r.counted, 'bar')}, ${r.skipped} notes kept` : `Counted ${plural(r.counted, 'bar')}`)
                close()
              }}
            >
              Count {plural(n, 'bar')}
            </button>
            <Hint>{byLayer ? `Counts start at 1 in each span of ${byLayer.label}.` : 'Counts start again after each group.'} Notes are kept.</Hint>
          </div>
        )}

        {view === 'split' && (
          <div className="flex flex-col gap-2.5 p-1.5">
            {formHead}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {groupSize}
              bars each
            </label>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                const r = splitIntoBars(otherSelected.map((s) => s.id), barGroup)
                if (r === 'occupied') return setHint('The bar layer has bars there already.')
                if (r) {
                  // The bar layer's first bars: what their tempo does is worth saying.
                  if (!allBars.length) setTempoOffer(r.layerId)
                  showToast(`Made ${plural(r.made, 'bar')}`)
                }
                close()
              }}
            >
              Split {plural(otherSelected.length, 'span')}
            </button>
            <Hint>{hint ?? 'New bars go on the bar layer.'}</Hint>
          </div>
        )}

        {view === 'list' && (
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between px-2.5 pb-1 pt-1.5 text-[11.5px] text-muted-foreground">
              <span className="font-semibold text-foreground">Bars</span>
              <span>{selectedBars.length ? `${selectedBars.length} selected` : `all ${allBars.length}`}</span>
            </div>
            {row('Number…', 'Label each bar with its number.', () => go('number'), none)}
            {row('Count…', "Number each bar's place in its group.", () => go('count'), none)}
            {row(
              'Elide',
              'End one group and start the next on this bar (4=1).',
              () => {
                if (!one) return
                elideSpan(barLayer.id, one.id, barGroup)
                showToast(one.label ? `Elided bar ${one.label}` : 'Elided the bar')
              },
              (!one || countOf(one.annotation) === null) && 'Select one counted bar to elide it.',
            )}
            {offer &&
              row(`Elide the ${offer.layer.label} boundary too`, `Mark the ${offer.layer.label} boundary on this bar elided.`, () => {
                if (!one) return
                elideGroupBoundary(barLayer.id, one.id)
                showToast(`Elided the ${offer.layer.label} boundary`)
                close()
              })}
            {row(
              'Phrases from count',
              'Start a phrase at every bar counted 1.',
              () => {
                const r = phrasesFromCount(ids)
                if (r) showToast(`Made ${plural(r.made, 'phrase')}`)
                close()
              },
              !counted && 'Count the bars first.',
            )}
            <div className="my-1 border-t border-border" />
            {row(
              'Normalize…',
              'Even out hand-marked timing.',
              () => {
                setNormalizing(ids)
                close()
              },
              none || (n < 2 && 'Select two bars or more.'),
            )}
            {row(
              'Beat grid from bars',
              'Make the grid follow these bars.',
              () => {
                const r = gridFromBars(ids)
                if (r) showToast(`Beat grid set from ${plural(r.bars, 'bar')}`)
                close()
              },
              none,
            )}
            <div className="my-1 border-t border-border" />
            {row('Split into bars…', 'Divide each selected span into equal bars.', () => go('split'), !otherSelected.length && 'Select phrases on another layer first.')}
            {row(
              'Fill from grid',
              'Add a bar for each bar of the grid.',
              () => {
                const made = numberBars(barLayer.id, barGroup)
                if (made) {
                  setTempoOffer(barLayer.id)
                  showToast(`Made ${plural(made, 'bar')}`)
                }
                close()
              },
              (!hasGrid && 'Add a beat grid first.') || (allBars.length > 0 && 'The bar layer has bars already.'),
            )}
            <Hint>{hint ?? (selectedBars.length ? ' ' : 'Acts on all bars. Select some to narrow it.')}</Hint>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
