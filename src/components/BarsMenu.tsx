/**
 * BarsMenu — Segments' Bars ▾ menu: every bar tool in one place (docs/decisions.md,
 * "Where Controls Live"). Bars, counts and elisions are segmentation, so they
 * live with Segments, not in the Inspector or a layer's ⋯ menu.
 *
 * Each item says what it does in a line and what it will act on: the selected
 * bars of the bar layer, or every bar when none are selected. An item that asks
 * for something first ends in "…" and opens a small form in the menu, with Back;
 * one that acts at once does so, says what it did, and stays open for the next.
 * Normalize… closes the menu and opens its mode under the tool row.
 *
 * Without a bar layer the menu offers only the ways to make bars, and says how
 * to make a layer the bar layer.
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
  'rounded border border-border bg-card px-1 py-0.5 text-center text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'
const primary = 'rounded bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40'

const plural = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`

/** One item: what it does in a line, and what it will act on. */
function Item({
  name,
  scope,
  line,
  disabled,
  why,
  onClick,
}: {
  name: string
  scope: string
  line: string
  disabled?: boolean
  why?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? why : undefined}
      className="grid w-full grid-cols-[1fr_auto] gap-x-3 rounded px-2.5 py-1.5 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span className="text-[13px] font-medium text-foreground">{name}</span>
      <span className="text-[11px] text-muted-foreground">{disabled && why ? why : scope}</span>
      <span className="col-span-2 text-[11px] leading-snug text-muted-foreground">{line}</span>
    </button>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-0.5 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
}

function Form({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 p-2.5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground">
        <ChevronLeft size={12} aria-hidden /> Bars
      </button>
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {children}
    </div>
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
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const barGroup = useUIStore((s) => s.barGroup)
  const setBarGroup = useUIStore((s) => s.setBarGroup)
  const setNormalizing = useUIStore((s) => s.setNormalizing)
  const setTempoOffer = useUIStore((s) => s.setTempoOffer)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('list')
  const [result, setResult] = useState<string | null>(null)
  const [first, setFirst] = useState<number | null>(null)
  const [by, setBy] = useState<string | null>(null)
  if (!doc) return null

  const barLayer = doc.layers.find((l): l is Layer => l.role === 'bars' && l.type === 'segmentation')
  const allBars = barLayer ? [...segmentSpans(barLayer)].sort((a, b) => a.startTime - b.startTime) : []
  const selectedBars = allBars.filter((s) => selectedIds.includes(s.id))
  // The bars a tool acts on: the selected ones, or every bar when none are selected.
  const bars: Span[] = selectedBars.length ? selectedBars : allBars
  const ids = bars.map((s) => s.id)
  const scope = selectedBars.length ? plural(selectedBars.length, 'bar') : `all ${allBars.length}`
  const one = selectedBars.length === 1 ? selectedBars[0] : null
  // Spans selected on another layer: phrases to split into bars.
  const otherSelected = doc.layers
    .filter((l) => l.type === 'segmentation' && l.id !== barLayer?.id)
    .flatMap((l) => segmentSpans(l).filter((s) => selectedIds.includes(s.id)))
  const active = doc.layers.find((l) => l.id === activeLayerId && l.type === 'segmentation')
  const activeEmpty = !!active && segmentSpans(active).length === 0
  const hasGrid = (doc.beatGrid?.length ?? 0) > 0
  const above = barLayer
    ? doc.layers
        .filter((l) => l.type === 'segmentation' && l.displayOrder > barLayer.displayOrder && segmentSpans(l).length > 0)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : []
  const byLayer = by === GROUPS ? null : (above.find((l) => l.id === by) ?? (by === null ? above[0] : undefined) ?? null)
  const firstNumber = first ?? (Number.isInteger(Number(bars[0]?.label)) ? Number(bars[0]?.label) : 1)
  const counted = bars.some((s) => countOf(s.annotation) !== null)
  const elided = one && (one.annotation ?? '').includes('=') && barLayer ? groupBoundaryOnBar(doc, barLayer.id, one.id) : null
  const offer = elided && elided.boundary.before.endBoundaryType !== 'elided' ? elided : null

  const done = (text: string | null) => {
    setResult(text)
    setView('list')
  }
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

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setView('list')
          setResult(null)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={MENU_TRIGGER} title="Number, count and elide bars; make phrases or the beat grid from them; even them out">
          Bars
          {barLayer && selectedBars.length > 0 && (
            <span className="rounded bg-accent px-1 text-[11px] text-foreground">{selectedBars.length}</span>
          )}
          <ChevronDown size={11} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1.5">
        {view === 'number' && barLayer && (
          <Form title={`Number ${scope === `all ${allBars.length}` ? `all ${allBars.length} bars` : scope}`} onBack={() => setView('list')}>
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
              <span>0 for a pickup</span>
            </label>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                numberBarLayer(barLayer.id, firstNumber, ids)
                done(`Numbered ${plural(bars.length, 'bar')} from ${firstNumber}.`)
              }}
            >
              Number
            </button>
          </Form>
        )}

        {view === 'count' && barLayer && (
          <Form title={`Count ${scope === `all ${allBars.length}` ? `all ${allBars.length} bars` : scope}`} onBack={() => setView('list')}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <select
                value={byLayer ? byLayer.id : GROUPS}
                onChange={(e) => setBy(e.target.value)}
                aria-label="Count the bars by"
                className="rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
              >
                {above.map((l) => (
                  <option key={l.id} value={l.id}>
                    By {l.label}: each from 1
                  </option>
                ))}
                <option value={GROUPS}>In groups of</option>
              </select>
              {!byLayer && groupSize}
            </div>
            <p className="text-[11px] text-muted-foreground">Writes each bar's place into its annotation, inside the shape. A note there is left alone.</p>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                const r = countBars(barLayer.id, byLayer?.id ?? null, barGroup, ids)
                done(`Counted ${r.counted}${byLayer ? ` by ${byLayer.label}` : ` in groups of ${barGroup}`}.` + (r.skipped ? ` Left ${r.skipped} alone: they hold notes.` : ''))
              }}
            >
              Count
            </button>
          </Form>
        )}

        {view === 'split' && (
          <Form title={`Split ${plural(otherSelected.length, 'span')} into bars`} onBack={() => setView('list')}>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {groupSize}
              bars each, equal length
            </label>
            <p className="text-[11px] text-muted-foreground">The bars go on the bar layer, or on a new one below, numbered on and counted.</p>
            <button
              type="button"
              className={`${primary} self-start`}
              onClick={() => {
                const r = splitIntoBars(otherSelected.map((s) => s.id), barGroup)
                if (r && r !== 'occupied' && !barLayer) setTempoOffer(r.layerId)
                done(r === 'occupied' ? 'The bar layer already has bars there.' : r ? `Made ${plural(r.made, 'bar')}.` : null)
              }}
            >
              Split
            </button>
          </Form>
        )}

        {view === 'list' && (
          <div className="flex flex-col">
            {barLayer ? (
              <>
                <Heading>
                  {barLayer.label} · {selectedBars.length ? `${plural(selectedBars.length, 'bar')} selected` : 'no bars selected: all'}
                </Heading>
                <Item name="Number…" scope={scope} line="Label them with bar numbers from a first bar (0 for a pickup)." onClick={() => setView('number')} />
                <Item name="Count…" scope={scope} line="Write each bar's place in its group: by a layer above, or in groups of N." onClick={() => setView('count')} />
                <Item
                  name="Elide"
                  scope="1 bar"
                  line="This bar ends one group and begins the next: its count becomes 4=1, and the bars after count on."
                  disabled={!one || countOf(one.annotation) === null}
                  why="Select one counted bar"
                  onClick={() => {
                    if (!one || !barLayer) return
                    elideSpan(barLayer.id, one.id, barGroup)
                    setResult(`Bar ${one.label ?? ''} elided.`)
                  }}
                />
                {offer && (
                  <Item
                    name={`Elide the ${offer.layer.label} boundary too`}
                    scope="1 boundary"
                    line={`${offer.layer.label} has a boundary on this bar: mark it elided, so one ends and the next begins here.`}
                    onClick={() => {
                      if (!one || !barLayer) return
                      elideGroupBoundary(barLayer.id, one.id)
                      setResult(`The ${offer.layer.label} boundary is elided.`)
                    }}
                  />
                )}
                <Item
                  name="Phrases from the count"
                  scope={scope}
                  line="Make a phrase on the layer above at every bar counted 1."
                  disabled={!counted}
                  why="Count the bars first"
                  onClick={() => {
                    const r = phrasesFromCount(ids)
                    setResult(r ? `Made ${plural(r.made, 'phrase')}.` : null)
                  }}
                />
                <div className="my-1 border-t border-border" />
                <Item
                  name="Normalize…"
                  scope={scope}
                  line="Even out hand-marked bars: one steady tempo, or a smooth curve."
                  disabled={bars.length < 2}
                  why="Needs two bars or more"
                  onClick={() => {
                    setNormalizing(ids)
                    setOpen(false)
                  }}
                />
                <Item
                  name="Beat grid from the bars"
                  scope={scope}
                  line="Make the beat grid follow these bars: a stretch per bar, equal tempos merged."
                  onClick={() => {
                    const r = gridFromBars(ids)
                    setResult(r ? `Made the grid: ${r.stretches} stretch${r.stretches === 1 ? '' : 'es'} from ${plural(r.bars, 'bar')}. Undo puts the old grid back.` : null)
                  }}
                />
                <div className="my-1 border-t border-border" />
              </>
            ) : (
              <p className="px-2.5 py-2 text-[12px] leading-snug text-muted-foreground">
                To number, count and normalize bars, turn on <span className="text-foreground">Bar layer</span> in the ⋯ menu of the layer that marks them. Or make bars:
              </p>
            )}
            <Heading>Make bars</Heading>
            <Item
              name="Split into bars…"
              scope={otherSelected.length ? plural(otherSelected.length, 'span') : 'selected spans'}
              line="Divide each selected phrase (or other span) into N equal bars."
              disabled={!otherSelected.length}
              why="Select phrases first"
              onClick={() => setView('split')}
            />
            <Item
              name="Fill with the grid's bars"
              scope={active ? active.label : 'a layer'}
              line="One bar per bar of the beat grid, numbered and counted, on an empty layer."
              disabled={!hasGrid || !activeEmpty}
              why={!hasGrid ? 'Needs a beat grid' : 'Click an empty layer first'}
              onClick={() => {
                if (!active) return
                const made = numberBars(active.id, barGroup)
                if (made) setTempoOffer(active.id)
                setResult(made ? `Made ${plural(made, 'bar')} on ${active.label}.` : null)
              }}
            />
            {result && (
              <p className="mx-2.5 mb-1 mt-1.5 rounded bg-accent px-2 py-1 text-[11px] text-foreground" role="status">
                {result}
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
