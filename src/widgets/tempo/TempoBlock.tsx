/**
 * TempoBlock — the tempo widget's block (widgets/tempo.md): a framed card on
 * the shared timeline, one row per tempo layer, each drawing the tempo of the
 * layer of bars it reads (lib/tempoLane.ts tempoView).
 *
 * A row is a header cell, as wide as the Segments block's layer names so the
 * timelines line up, and a canvas that scrolls with the diagram: the tempo as
 * marked (a step line), as smoothed (a line through each bar, for the drawing
 * only), and each boundary's deviation from the smoothed curve in ms, with
 * the tapping scatter shaded. Hovering a bar shows its tempo; clicking it
 * selects that bar. The block's top bar carries the controls WorkArea
 * hands it (move, hide, remove); while editing, a tool row under it holds
 * View ▾ and Scale ▾ (./TempoMenus.tsx); each row's ⋯ holds its settings, its
 * name and the layer it reads.
 */
import { useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { computePps, scrollableWidth } from '@/lib/timeline'
import { TEMPO_LANE_HEIGHT, deviationRange, tempoView, tempoY, type TempoView } from '@/lib/tempoLane'
import { segmentSpans } from '@/lib/layers'
import { Playhead } from '@/components/Playhead'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TempoScaleMenu, TempoViewMenu } from './TempoMenus'
import type { StrataDocument, TempoLayer } from '@/types/strata'

const TOP_BAR_HEIGHT = 24
/** Height of the deviation band, under the tempo, when it is shown. */
const DEVIATION_HEIGHT = 40
const SMOOTH_COLOR = '#2563eb'
const ROW_GAP = 3

/** Whether a row draws the tempo band: unless deviation is all it shows. */
function showsTempo(layer: TempoLayer): boolean {
  const show = layer.data?.display?.show ?? ['marked']
  return !(show.length === 1 && show[0] === 'deviation')
}

/** A tempo row's height: the tempo band, the deviation band, or both. */
function tempoRowHeight(layer: TempoLayer): number {
  const dev = (layer.data?.display?.show ?? []).includes('deviation')
  return (showsTempo(layer) ? TEMPO_LANE_HEIGHT : 0) + (dev ? DEVIATION_HEIGHT : 0)
}

export function TempoBlock({
  headerWidth,
  reading,
  controls,
}: {
  headerWidth: number
  reading: boolean
  controls?: ReactNode
}) {
  const doc = useDocumentStore((s) => s.document)
  const layers = (doc?.layers ?? []).filter((l): l is TempoLayer => l.type === 'tempo').sort((a, b) => b.displayOrder - a.displayOrder)
  if (!doc || !layers.length) return null
  return (
    <div data-keeps-selection data-touch-pan className="relative shrink-0 overflow-hidden rounded-md bg-(--canvas)" style={{ marginBottom: 4 }}>
      <div className="flex items-center gap-1 border-b pl-2 pr-2" style={{ height: TOP_BAR_HEIGHT, borderColor: 'var(--hairline)' }}>
        <span className="text-[12px] font-medium" style={{ color: 'var(--ink-primary)' }}>
          Tempo
        </span>
        <div className="ml-auto flex items-center gap-0.5">{controls}</div>
      </div>
      {/* The tool row, while editing (docs/decisions.md, "Tempo Gets a Tool Row"). */}
      {!reading && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-2 py-1" style={{ borderColor: 'var(--hairline)', background: 'var(--guide-faint)' }}>
          <TempoViewMenu layers={layers} />
          <TempoScaleMenu layers={layers} />
        </div>
      )}
      {layers.map((layer) => (
        <TempoRow key={layer.id} doc={doc} layer={layer} headerWidth={headerWidth} reading={reading} />
      ))}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-md" style={{ border: '1px solid var(--ruler)' }} />
    </div>
  )
}

function TempoRow({ doc, layer, headerWidth, reading }: { doc: StrataDocument; layer: TempoLayer; headerWidth: number; reading: boolean }) {
  const zoom = useUIStore((s) => s.zoom)
  const scrollOffset = useUIStore((s) => s.scrollOffset)
  const viewportWidth = useUIStore((s) => s.viewportWidth)
  const view = tempoView(doc, layer)
  const pps = computePps(zoom)
  const height = tempoRowHeight(layer)
  const width = Math.max(scrollableWidth(doc.duration, zoom), viewportWidth)
  const show = layer.data.display?.show ?? ['marked']
  const tempoTop = showsTempo(layer) ? 0 : null
  const devTop = show.includes('deviation') ? (tempoTop === null ? 0 : TEMPO_LANE_HEIGHT) : null

  return (
    <div className="flex w-full" style={{ height: height + ROW_GAP }}>
      <div className="flex shrink-0 items-start justify-between gap-1 border-r px-2 pt-1" style={{ width: headerWidth, borderColor: 'var(--hairline)' }}>
        <span className="truncate text-[12px]" style={{ color: 'var(--ink-primary)' }} title={layer.label}>
          {headerWidth > 60 ? layer.label : ''}
        </span>
        {!reading && headerWidth > 60 && <TempoSettings doc={doc} layer={layer} />}
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {!view.source ? (
          <p className="px-2 pt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            The layer this tempo reads is gone. Choose another in its settings (⋯).
          </p>
        ) : view.marked.length + view.smoothed.length + view.deviations.length === 0 ? (
          <p className="px-2 pt-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {segmentSpans(view.source).length < 2 ? `Mark two bars or more on ${view.source.label} to see their tempo.` : reading ? 'Nothing is chosen to show.' : 'Choose what to show in View.'}
          </p>
        ) : (
          <>
            <svg style={{ position: 'absolute', top: 0, left: -scrollOffset, width, height, display: 'block' }}>
              {tempoTop !== null && <TempoLines view={view} top={tempoTop} pps={pps} width={width} />}
              {devTop !== null && <DeviationLines view={view} top={devTop} pps={pps} width={width} />}
            </svg>
            <ScaleLabels view={view} tempoTop={tempoTop} devTop={devTop} />
            <Playhead height={height} opacity={0.5} />
          </>
        )}
      </div>
    </div>
  )
}

/** The tempo band: guides, the marked step line, the smoothed line, a hover title and click per bar. */
function TempoLines({ view, top, pps, width }: { view: TempoView; top: number; pps: number; width: number }) {
  const y = (bpm: number) => tempoY(bpm, view.scale, top)
  const step = (steps: TempoView['marked']) => {
    let d = ''
    steps.forEach((s, k) => {
      const prev = steps[k - 1]
      d += prev && Math.abs(prev.end - s.start) < 1e-6 ? ` L${s.start * pps},${y(s.bpm)}` : ` M${s.start * pps},${y(s.bpm)}`
      d += ` L${s.end * pps},${y(s.bpm)}`
    })
    return d.trim()
  }
  // The smoothed tempo as a line through the middle of each bar.
  const through = (steps: TempoView['smoothed']) => {
    let d = ''
    steps.forEach((s, k) => {
      const prev = steps[k - 1]
      const x = ((s.start + s.end) / 2) * pps
      d += prev && Math.abs(prev.end - s.start) < 1e-6 ? ` L${x},${y(s.bpm)}` : ` M${x},${y(s.bpm)}`
    })
    return d.trim()
  }
  const hits = view.marked.length ? view.marked : view.smoothed
  return (
    <g>
      {view.scale.ticks.map((t) => (
        <line key={t} x1={0} x2={width} y1={y(t)} y2={y(t)} stroke="var(--ink-faint)" strokeOpacity={0.5} strokeWidth={0.75} strokeDasharray="2 3" />
      ))}
      {view.marked.length > 0 && (
        <path
          d={step(view.marked)}
          fill="none"
          stroke="var(--ink-primary)"
          strokeOpacity={view.smoothed.length ? 0.45 : 1}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}
      {view.smoothed.length > 0 && <path d={through(view.smoothed)} fill="none" stroke={SMOOTH_COLOR} strokeWidth={1.75} strokeLinejoin="round" />}
      {hits.map((s, k) => (
        <rect
          key={k}
          x={s.start * pps}
          y={top}
          width={Math.max(0, (s.end - s.start) * pps)}
          height={TEMPO_LANE_HEIGHT}
          fill="transparent"
          style={{ cursor: s.id ? 'pointer' : undefined }}
          onClick={() => s.id && useUIStore.getState().selectSpan(s.id)}
        >
          <title>{`${s.bar ? `Bar ${s.bar}: ` : ''}${Math.round(s.bpm * 10) / 10} BPM`}</title>
        </rect>
      ))}
    </g>
  )
}

/** The deviation band: each boundary's distance from the smoothed curve, the tapping scatter shaded. */
function DeviationLines({ view, top, pps, width }: { view: TempoView; top: number; pps: number; width: number }) {
  const range = deviationRange(view)
  const mid = top + DEVIATION_HEIGHT / 2
  const scaleY = (DEVIATION_HEIGHT / 2 - 4) / range
  const band = view.scatterMs * scaleY
  return (
    <g>
      <line x1={0} x2={width} y1={top + 0.5} y2={top + 0.5} stroke="var(--ink-faint)" strokeOpacity={0.5} />
      <rect x={0} y={mid - band} width={width} height={band * 2} fill="var(--ink-faint)" fillOpacity={0.15} />
      <line x1={0} x2={width} y1={mid} y2={mid} stroke="var(--ink-faint)" strokeWidth={0.75} />
      {view.deviations.map((d, k) => {
        const outside = Math.abs(d.ms) > view.scatterMs
        // Beyond the band's range, drawn to its edge with a cap.
        const clipped = Math.abs(d.ms) > range
        const y2 = mid - Math.max(-range, Math.min(range, d.ms)) * scaleY
        const x = d.time * pps
        return (
          <g key={k}>
            <line x1={x} x2={x} y1={mid} y2={y2} stroke={outside ? 'var(--ink-primary)' : 'var(--ink-faint)'} strokeWidth={2}>
              <title>{`${d.ms > 0 ? '+' : ''}${Math.round(d.ms)} ms`}</title>
            </line>
            {clipped && <line x1={x - 3} x2={x + 3} y1={y2} y2={y2} stroke="var(--ink-primary)" strokeWidth={1.5} />}
          </g>
        )
      })}
    </g>
  )
}

/** The scales' labels, kept at the canvas's left edge while the drawing scrolls. */
function ScaleLabels({ view, tempoTop, devTop }: { view: TempoView; tempoTop: number | null; devTop: number | null }) {
  const label = 'absolute whitespace-nowrap px-0.5'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1 text-[10px] leading-none tabular-nums" style={{ color: 'var(--ink-muted)' }}>
      {tempoTop !== null &&
        view.scale.ticks.map((t) => (
          <span key={t} className={label} style={{ top: tempoY(t, view.scale, tempoTop) - 11, background: 'var(--canvas)' }}>
            {t === view.scale.max ? `${t} BPM` : t}
          </span>
        ))}
      {devTop !== null && (
        <span className={label} style={{ top: devTop + 3, background: 'var(--canvas)' }}>
          ±{deviationRange(view)} ms · scatter ±{Math.round(view.scatterMs)} ms
        </span>
      )}
    </div>
  )
}

/** A tempo row's settings: its name and the layer it reads. What it shows is in the tool row's menus. */
function TempoSettings({ doc, layer }: { doc: StrataDocument; layer: TempoLayer }) {
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  const setSource = useDocumentStore((s) => s.setTempoSource)
  const [open, setOpen] = useState(false)
  const forms = doc.layers.filter((l) => l.type === 'segmentation')
  const box = 'rounded border px-1.5 py-0.5 text-xs'
  const boxStyle = { borderColor: 'var(--hairline)', color: 'var(--ink-primary)', background: 'transparent' }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="shrink-0 rounded p-0.5 hover:bg-accent" style={{ color: 'var(--ink-muted)' }} aria-label="Tempo settings" title="Tempo settings">
          <MoreHorizontal size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-3 p-3 text-[13px]">
        <label className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Name</span>
          <input className={box} style={boxStyle} value={layer.label} onChange={(e) => updateLayer(layer.id, { label: e.target.value || 'Tempo' })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>Reads the bars of</span>
          <select className={box} style={boxStyle} value={layer.data.source.layerId} onChange={(e) => setSource(layer.id, e.target.value)}>
            {!forms.some((l) => l.id === layer.data.source.layerId) && <option value={layer.data.source.layerId}>(gone)</option>}
            {forms.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
                {l.role === 'bars' ? ' (bar layer)' : ''}
              </option>
            ))}
          </select>
        </label>
      </PopoverContent>
    </Popover>
  )
}
