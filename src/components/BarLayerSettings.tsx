/**
 * BarLayerSettings — the bar layer's part of the layer menu (lib/hypermeter.ts,
 * docs/decisions.md "The Bar Layer").
 *
 * A switch makes the layer the bar layer: one span per bar, its label the bar
 * number and its annotation the hypermetric count. On the bar layer the menu
 * numbers the bars from a first bar and counts them, by the spans of a layer
 * above (each phrase counts from 1) or in groups of a set size. An empty layer
 * can instead be filled with the beat grid's bars, which makes it the bar layer.
 * The Tempo lane switch draws each bar's tempo under the diagram (lib/tempoLane.ts).
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { formSpans } from '@/lib/layers'
import { Switch } from '@/components/ui/switch'
import type { Layer } from '@/types/strata'

const button = 'rounded border px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50'
const buttonStyle = { borderColor: 'var(--hairline)', color: 'var(--ink-primary)' }
const boxStyle = { borderColor: 'var(--hairline)', color: 'var(--ink-primary)', background: 'transparent' }
const GROUPS = 'groups'

export function BarLayerSettings({ layer }: { layer: Layer }) {
  const layers = useDocumentStore((s) => s.document?.layers)
  const hasGrid = useDocumentStore((s) => (s.document?.beatGrid?.length ?? 0) > 0)
  const setBarLayer = useDocumentStore((s) => s.setBarLayer)
  const numberBarLayer = useDocumentStore((s) => s.numberBarLayer)
  const countBars = useDocumentStore((s) => s.countBars)
  const numberBars = useDocumentStore((s) => s.numberBars)
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  const barGroup = useUIStore((s) => s.barGroup)
  const setBarGroup = useUIStore((s) => s.setBarGroup)
  const [first, setFirst] = useState(1)
  const [result, setResult] = useState<string | null>(null)

  const isBars = layer.role === 'bars'
  const count = formSpans(layer).length
  // Layers above that could group the bars, nearest first.
  const above = (layers ?? [])
    .filter((l) => l.type === 'form-diagram' && l.displayOrder > layer.displayOrder && formSpans(l).length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const [by, setBy] = useState<string>(above[0]?.id ?? GROUPS)
  const byLayer = above.find((l) => l.id === by) ?? null

  function fill() {
    const made = numberBars(layer.id, barGroup)
    setResult(made ? `Made ${made} bars, numbered, and counted in groups of ${barGroup}.` : 'The grid has no bars here.')
  }

  function runCount() {
    const { counted, skipped } = countBars(layer.id, byLayer?.id ?? null, barGroup)
    const how = byLayer ? `from 1 in each span of ${byLayer.label}` : `in groups of ${barGroup}`
    setResult(
      `Counted ${counted} bar${counted === 1 ? '' : 's'} ${how}.` +
        (skipped ? ` Left ${skipped} alone: their annotations hold other text.` : ''),
    )
  }

  const groupSize = (
    <input
      type="number"
      min={1}
      max={16}
      value={barGroup}
      onChange={(e) => setBarGroup(Number(e.target.value) || 1)}
      aria-label="Bars in a group"
      title="Bars in a group"
      className="w-10 rounded border px-1 py-0.5 text-center text-xs tabular-nums"
      style={boxStyle}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="flex cursor-pointer items-center justify-between gap-3"
        title="This layer has a span for every bar: labels are bar numbers, annotations are hypermetric counts"
      >
        <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
          Bar layer
        </span>
        <Switch
          checked={isBars}
          onCheckedChange={(v) => {
            setBarLayer(layer.id, v)
            setResult(null)
          }}
          aria-label="Bar layer"
        />
      </label>

      {count === 0 && (
        <div
          className="flex items-center justify-between gap-2"
          title="Fill this empty layer with one span per bar of the beat grid, numbered and counted, and make it the bar layer"
        >
          <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
            Fill with the grid&rsquo;s bars
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            in groups of {groupSize}
            <button type="button" disabled={!hasGrid} onClick={fill} className={button} style={buttonStyle}>
              Fill
            </button>
          </span>
        </div>
      )}

      {isBars && count > 0 && (
        <>
          <label
            className="flex cursor-pointer items-center justify-between gap-3"
            title="Draw each bar's tempo, worked out from its length, in a lane under the diagram"
          >
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              Tempo lane
            </span>
            <Switch
              checked={!!layer.showTempo}
              onCheckedChange={(v) => updateLayer(layer.id, { showTempo: v || undefined })}
              aria-label="Tempo lane"
            />
          </label>

          <div className="flex items-center justify-between gap-2" title="Label every bar with its number, in order">
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              Number from bar
            </span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={first}
                onChange={(e) => setFirst(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                aria-label="First bar number"
                title="The first bar's number: 0 for a pickup"
                className="w-12 rounded border px-1 py-0.5 text-center text-xs tabular-nums"
                style={boxStyle}
              />
              <button
                type="button"
                onClick={() => {
                  numberBarLayer(layer.id, first)
                  setResult(`Numbered ${count} bars from ${first}.`)
                }}
                className={button}
                style={buttonStyle}
              >
                Number
              </button>
            </span>
          </div>

          <div
            className="flex items-center justify-between gap-2"
            title="Write each bar's place in its group into its annotation. By a layer: each of its spans counts from 1. Annotations holding other text are left alone."
          >
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              Count
            </span>
            <span className="flex items-center gap-1 text-xs">
              <select
                value={byLayer ? byLayer.id : GROUPS}
                onChange={(e) => setBy(e.target.value)}
                aria-label="Count the bars by"
                className="max-w-[7rem] rounded border px-1 py-0.5 text-xs"
                style={boxStyle}
              >
                {above.map((l) => (
                  <option key={l.id} value={l.id}>
                    by {l.label}
                  </option>
                ))}
                <option value={GROUPS}>in groups of</option>
              </select>
              {!byLayer && groupSize}
              <button type="button" onClick={runCount} className={button} style={buttonStyle}>
                Count
              </button>
            </span>
          </div>
        </>
      )}

      {(result || (count === 0 && !hasGrid)) && (
        <span className="text-[11px]" role="status" style={{ color: 'var(--ink-muted)' }}>
          {result ?? 'Filling with bars needs a beat grid.'}
        </span>
      )}
    </div>
  )
}
