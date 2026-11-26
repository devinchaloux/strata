/**
 * BarLayerSettings — the bar layer's part of the layer menu (docs/decisions.md,
 * "The Bar Layer" and "Where Controls Live").
 *
 * A setting only: the switch makes the layer the bar layer (one span per bar,
 * its label the bar number and its hypermeter its place in a group). What is
 * done to bars (number, count, elide, phrases, normalize, the beat grid, making
 * bars) is in Segments' Bars menu, and the menu says so.
 */
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { Switch } from '@/components/ui/switch'
import type { Layer } from '@/types/strata'

export function BarLayerSettings({ layer }: { layer: Layer }) {
  const setBarLayer = useDocumentStore((s) => s.setBarLayer)
  const setTempoOffer = useUIStore((s) => s.setTempoOffer)
  const isBars = layer.role === 'bars'
  return (
    <div className="flex flex-col gap-1">
      <label
        className="flex cursor-pointer items-center justify-between gap-3"
        title="This layer has a span for every bar: labels are bar numbers, and each bar's hypermeter is its place in a group"
      >
        <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
          Bar layer
        </span>
        <Switch
          checked={isBars}
          onCheckedChange={(v) => {
            setBarLayer(layer.id, v)
            // Offer Tempo above the blocks, if the tempo moves (WidgetStrip).
            setTempoOffer(v ? layer.id : null)
          }}
          aria-label="Bar layer"
        />
      </label>
      {isBars && (
        <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
          Tools: Bars ▾ in the Segments tool row
        </span>
      )}
    </div>
  )
}
