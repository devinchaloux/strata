/**
 * LayerSettingsPopover — the `⋯` layer settings menu in the expanded track header.
 *
 * Controls: rename, description, library, fill/stroke default colors, size,
 * key-area shape (thin bars), whether B fills gaps, the hypermeter's
 * showing and line (once the layer has one), the bar layer
 * (BarLayerSettings), lock, and delete: settings only (docs/decisions.md,
 * "Where Controls Live"). Fit to grid is in the Grid menu.
 *
 * Hierarchical enforcement is deliberately NOT here: it was redefined as a
 * cross-layer nesting constraint scoped to the segmentation widget (not per-layer),
 * so its control belongs at the widget level and its enforcement logic is its own
 * future work item. See docs/decisions.md and _private/open-questions.md.
 *
 * Built on the shadcn/Radix primitives so focus, Escape, click-outside, and
 * positioning are handled correctly. Delete removes the layer this popover lives
 * in, so its confirm dialog is hoisted to LayerHeaders (via `onRequestDelete`) —
 * otherwise confirming would unmount the open dialog's own subtree and Radix would
 * throw.
 */

import { Lock, Trash2 } from 'lucide-react'
import { MoreHorizontal } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { BarLayerSettings } from '@/components/BarLayerSettings'
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import { LIBRARIES } from '@/lib/vocabulary'
import { segmentSpans } from '@/lib/layers'
import type { Layer } from '@/types/strata'

// Factory defaults — used as the fallback preview in the reset button.
const FILL_DEFAULT = '#ffffff'
const STROKE_DEFAULT = '#475569'

export function LayerSettingsPopover({
  layer,
  onRequestDelete,
}: {
  layer: Layer
  onRequestDelete: () => void
}) {
  const updateLayer = useDocumentStore((s) => s.updateLayer)



  const labelStyle = { color: 'var(--ink-muted)' }
  const fieldClass =
    'w-full rounded border px-2 py-1 text-[13px] outline-hidden focus:ring-1 focus:ring-ring'
  const fieldStyle = { borderColor: 'var(--hairline)', color: 'var(--ink-primary)' }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="shrink-0 rounded p-0.5 hover:bg-accent"
          style={{ color: 'var(--ink-muted)' }}
          title="Layer settings"
          aria-label="Layer settings"
        >
          <MoreHorizontal size={14} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" side="right" sideOffset={6} className="w-64 p-3">
        <div className="space-y-3">
          {/* Rename */}
          <div className="space-y-1">
            <label className="block text-xs font-medium" style={labelStyle}>
              Label
            </label>
            <input
              value={layer.label}
              onChange={(e) => updateLayer(layer.id, { label: e.target.value })}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-xs font-medium" style={labelStyle}>
              Description
            </label>
            <textarea
              value={layer.description ?? ''}
              onChange={(e) =>
                updateLayer(layer.id, { description: e.target.value || null })
              }
              rows={2}
              placeholder="The framework or purpose of this layer"
              className={cn(fieldClass, 'resize-none')}
              style={fieldStyle}
            />
          </div>

          {/* Where the Type list and quick entry draw this layer's types from. */}
          <div className="space-y-1">
            <label
              className="text-xs font-medium"
              style={labelStyle}
              htmlFor={`library-${layer.id}`}
              title="The library whose types this layer offers first"
            >
              Library
            </label>
            <select
              id={`library-${layer.id}`}
              value={layer.library ?? ''}
              onChange={(e) => updateLayer(layer.id, { library: e.target.value || null })}
              className={fieldClass}
              style={fieldStyle}
            >
              <option value="">Guess from its types</option>
              {LIBRARIES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* Default colors */}
          <div className="space-y-2">
            <p className="text-xs font-medium" style={labelStyle}>Default colors</p>
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs" style={labelStyle}>Fill</span>
              <ColorPicker
                value={layer.fillColorDefault}
                fallback={FILL_DEFAULT}
                nullLabel="Reset to default"
                onChange={(c) =>
                  updateLayer(layer.id, { fillColorDefault: c ?? FILL_DEFAULT })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs" style={labelStyle}>Stroke</span>
              <ColorPicker
                value={layer.strokeColorDefault}
                fallback={STROKE_DEFAULT}
                nullLabel="Reset to default"
                onChange={(c) =>
                  updateLayer(layer.id, { strokeColorDefault: c ?? STROKE_DEFAULT })
                }
              />
            </div>
          </div>

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* Text size — the layer-level fontScale; uniform within a layer. */}
          <div className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              Text size
            </span>
            <div className="flex overflow-hidden rounded border" style={{ borderColor: 'var(--hairline)' }} role="radiogroup" aria-label="Text size">
              {(['sm', 'md', 'lg'] as const).map((size) => {
                const on = (layer.fontScale ?? 'md') === size
                return (
                  <button
                    key={size}
                    role="radio"
                    aria-checked={on}
                    aria-label={{ sm: 'Small', md: 'Medium', lg: 'Large' }[size]}
                    onClick={() => updateLayer(layer.id, { fontScale: size })}
                    className={cn('px-2 py-0.5 text-xs', on ? 'bg-accent font-medium' : 'hover:bg-accent/60')}
                    style={{ color: on ? 'var(--ink-primary)' : 'var(--ink-muted)' }}
                  >
                    {{ sm: 'S', md: 'M', lg: 'L' }[size]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* Shape — buried here rather than offered when first creating a
              layer (per docs/decisions.md "Key-Area Bar Layers"). Purely
              visual: same Span data model and interactions either way. */}
          {/* Each setting is one line; what it does is on hover. */}
          <label
            className="flex cursor-pointer items-center justify-between gap-3"
            title="Draw this layer's spans as thin bars instead of brackets, for key areas"
          >
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              Thin bars (key areas)
            </span>
            <Switch
              checked={layer.spanShape === 'bar'}
              onCheckedChange={(v) => updateLayer(layer.id, { spanShape: v ? 'bar' : 'bracket' })}
              aria-label="Thin bars (key areas)"
            />
          </label>

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* B in an empty stretch: fill back to the previous boundary too, or
              only start a span (docs/decisions.md, "B in an Empty Stretch"). */}
          <label
            className="flex cursor-pointer items-center justify-between gap-3"
            title="On: B in an empty stretch makes a span on each side of the playhead. Off: B starts a span and Shift+B ends it, so you can leave gaps."
          >
            <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              B fills gaps
            </span>
            <Switch
              checked={layer.fillGaps !== false}
              onCheckedChange={(v) => updateLayer(layer.id, { fillGaps: v ? undefined : false })}
              aria-label="B fills gaps"
            />
          </label>

          {/* The hypermeter, once this layer's spans carry one (docs/decisions.md,
              "The Hypermeter Is Its Own Field"): shown or not, and whether it
              shares the annotation's line. A span can override the showing. */}
          {layer.type === 'segmentation' && segmentSpans(layer).some((s) => s.hypermeter) && (
            <>
              <div className="h-px" style={{ background: 'var(--hairline)' }} />
              <label
                className="flex cursor-pointer items-center justify-between gap-3"
                title="Draw each span's hypermeter, centered in its shape. A span's own Show, in the Inspector, wins."
              >
                <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
                  Show hypermeter
                </span>
                <Switch
                  checked={layer.showHypermeter !== false}
                  onCheckedChange={(v) => updateLayer(layer.id, { showHypermeter: v ? undefined : false })}
                  aria-label="Show hypermeter"
                />
              </label>
              <div className="flex items-center justify-between" title="Shared: the annotation gives way to the hypermeter on its line. Own line: the annotation goes below it.">
                <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
                  Hypermeter line
                </span>
                <div className="flex overflow-hidden rounded border" style={{ borderColor: 'var(--hairline)' }} role="radiogroup" aria-label="Hypermeter line">
                  {(['shared', 'own'] as const).map((line) => {
                    const on = (layer.rendering?.hypermeterLine ?? 'shared') === line
                    return (
                      <button
                        key={line}
                        role="radio"
                        aria-checked={on}
                        onClick={() => updateLayer(layer.id, { rendering: { ...layer.rendering, hypermeterLine: line === 'shared' ? undefined : line } })}
                        className={cn('px-2 py-0.5 text-xs', on ? 'bg-accent font-medium' : 'hover:bg-accent/60')}
                        style={{ color: on ? 'var(--ink-primary)' : 'var(--ink-muted)' }}
                      >
                        {line === 'shared' ? 'Shared' : 'Own'}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* The bar layer switch (BarLayerSettings); its tools are in Bars. */}
          {layer.type === 'segmentation' && (
            <>
              <div className="h-px" style={{ background: 'var(--hairline)' }} />
              <BarLayerSettings layer={layer} />
            </>
          )}

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* Lock */}
          <label className="flex cursor-pointer items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--ink-primary)' }}>
              <Lock size={13} style={{ color: 'var(--ink-muted)' }} />
              Lock layer
            </span>
            <Switch
              checked={layer.locked}
              onCheckedChange={(v) => updateLayer(layer.id, { locked: v })}
              aria-label="Lock layer"
            />
          </label>

          <div className="h-px" style={{ background: 'var(--hairline)' }} />

          {/* Delete — confirmation dialog is owned by LayerHeaders (see header). */}
          <button
            onClick={onRequestDelete}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[13px] hover:bg-accent"
            style={{ color: 'hsl(var(--destructive))' }}
          >
            <Trash2 size={13} />
            Delete layer
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
