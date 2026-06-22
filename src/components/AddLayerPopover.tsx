/**
 * AddLayerPopover — the `[+]` add-layer control in the widget top bar.
 *
 * Phase 0.4 §2 "Adding a layer": a `[+]` button opens an inline form with a widget
 * type selector (v1: only "form-diagram"), an auto-focused label input, and
 * Create/Cancel. The new layer goes on top of the stack (highest displayOrder) and
 * becomes the active layer so Spacebar placements land in it immediately.
 *
 * New layers default to an open-bracket look (white fill reads as no-fill on the
 * white canvas — not a grey box) with a neutral ink stroke, matching the existing
 * fixture layers. Per-span color is the only place fills are chosen.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import type { Layer } from '@/types/strata'

const NEW_LAYER_FILL_DEFAULT = '#ffffff'
const NEW_LAYER_STROKE_DEFAULT = '#475569'

export function AddLayerPopover() {
  const layers = useDocumentStore((s) => s.document?.layers)
  const addLayer = useDocumentStore((s) => s.addLayer)
  const setActiveLayer = useUIStore((s) => s.setActiveLayer)

  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')

  function close() {
    setOpen(false)
    setLabel('')
  }

  function createLayer() {
    const trimmed = label.trim()
    if (!trimmed) return
    // New layer goes on top: one above the current max displayOrder.
    const maxOrder = (layers ?? []).reduce((m, l) => Math.max(m, l.displayOrder), -1)
    const id = crypto.randomUUID()
    const layer: Layer = {
      id,
      type: 'form-diagram',
      label: trimmed,
      visibility: true,
      locked: false,
      fillColorDefault: NEW_LAYER_FILL_DEFAULT,
      strokeColorDefault: NEW_LAYER_STROKE_DEFAULT,
      displayOrder: maxOrder + 1,
      data: { hierarchicalEnforcement: false, spans: [] },
    }
    addLayer(layer)
    setActiveLayer(id)
    close()
  }

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          className="rounded p-0.5 hover:bg-accent"
          style={{ color: 'var(--ink-muted)' }}
          title="Add layer"
          aria-label="Add layer"
        >
          <Plus size={15} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" sideOffset={6} className="w-60 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createLayer()
          }}
          className="space-y-3"
        >
          {/* Widget type — only form-diagram in v1, shown read-only for clarity. */}
          <div className="space-y-1">
            <span className="block text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              Widget type
            </span>
            <div
              className="rounded border px-2 py-1 text-[12px]"
              style={{
                borderColor: 'var(--hairline)',
                color: 'var(--ink-primary)',
                background: 'var(--guide-faint)',
              }}
            >
              Form diagram
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
              Label
            </label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Phrase rhythm"
              className="w-full rounded border px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-ring"
              style={{ borderColor: 'var(--hairline)', color: 'var(--ink-primary)' }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!label.trim()}>
              Create
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
