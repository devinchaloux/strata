/**
 * LayerSettingsPopover — the `⋯` layer settings menu in the expanded track header.
 *
 * Controls: rename, description, fill/stroke default colors, lock, and delete.
 *
 * Hierarchical enforcement is deliberately NOT here: it was redefined as a
 * cross-layer nesting constraint scoped to the form-diagram widget (not per-layer),
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
import { ColorPicker } from '@/components/ui/color-picker'
import { cn } from '@/lib/utils'
import { LIBRARIES } from '@/lib/vocabulary'
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
    'w-full rounded border px-2 py-1 text-[13px] outline-none focus:ring-1 focus:ring-ring'
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
            <label className="text-xs font-medium" style={labelStyle} htmlFor={`library-${layer.id}`}>
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
          <label className="flex cursor-pointer items-center justify-between">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px]" style={{ color: 'var(--ink-primary)' }}>
                Key-area layer (thin bars)
              </span>
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                Thin bars instead of brackets, for key areas rather than sections.
              </span>
            </span>
            <Switch
              checked={layer.spanShape === 'bar'}
              onCheckedChange={(v) => updateLayer(layer.id, { spanShape: v ? 'bar' : 'bracket' })}
              aria-label="Key-area layer (thin bars)"
            />
          </label>

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
