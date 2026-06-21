/**
 * FormDiagram — the form-diagram *widget*: a bounded block of a widget top bar,
 * the layer-header column, and the stack of form layers, sitting on the shared
 * timeline ruler.
 *
 * The widget defines its own upper boundary (the top bar) rather than claiming
 * the empty space above it — that space belongs to other widgets that stack on
 * the timeline. The whole block bottom-anchors onto the ruler.
 *
 * Alignment invariant (Phase 0.4 §1 / Phase 0.7 §2): the ruler's zero begins at
 * the same x as the left edge of the span content area; both the layer stack and
 * the ruler sit to the right of a fixed-width header column.
 *
 * Visibility: hidden layers reclaim their vertical slot entirely (so the diagram
 * reads as a complete graphic), and surface as "show" chips in the top bar.
 * Stacking order is macro-on-top (highest displayOrder at the top).
 */

import {
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  MoreHorizontal,
} from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { TimelineAxis } from './TimelineAxis'
import { FormLayers } from './FormLayers'
import { LAYER_PITCH, STACK_TOP_PAD, stackHeight } from '@/lib/formShape'
import type { Layer } from '@/types/strata'

const HEADER_WIDTH_EXPANDED = 122
const HEADER_WIDTH_RAIL = 34
const TOP_BAR_HEIGHT = 24

// ---------------------------------------------------------------------------
// Layer header column (visible layers only — hidden ones live in the top bar)
// ---------------------------------------------------------------------------

function LayerHeaders({ layers, collapsed }: { layers: Layer[]; collapsed: boolean }) {
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const setActiveLayer = useUIStore((s) => s.setActiveLayer)
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  const width = collapsed ? HEADER_WIDTH_RAIL : HEADER_WIDTH_EXPANDED

  return (
    <div className="shrink-0 border-r" style={{ width, borderColor: 'var(--hairline)' }}>
      {/* Top headroom matching the stack so header rows align with the shapes */}
      <div style={{ height: STACK_TOP_PAD }} />

      {layers.map((layer) => {
        const active = layer.id === activeLayerId
        return (
          <div
            key={layer.id}
            style={{ height: LAYER_PITCH }}
            onClick={collapsed ? () => setActiveLayer(layer.id) : undefined}
            className={`relative flex items-center ${collapsed ? 'cursor-pointer justify-center' : 'gap-1.5 pl-2.5 pr-1.5'}`}
          >
            {/* Active-layer accent bar (load-bearing per 0.4 §2 — spacebar target) */}
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-[2.5px]"
                style={{ backgroundColor: 'hsl(var(--primary))' }}
              />
            )}

            {collapsed ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  updateLayer(layer.id, { visibility: false })
                }}
                className="shrink-0 hover:opacity-80"
                style={{ color: 'var(--ink-muted)' }}
                title={`Hide ${layer.label}`}
                aria-label="Hide layer"
              >
                <Eye size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={() => updateLayer(layer.id, { visibility: false })}
                  className="shrink-0 hover:opacity-80"
                  style={{ color: 'var(--ink-muted)' }}
                  title="Hide layer"
                  aria-label="Hide layer"
                >
                  <Eye size={14} />
                </button>
                <button
                  className="min-w-0 flex-1 truncate text-left text-[11px]"
                  style={{ color: 'var(--ink-primary)', fontWeight: active ? 500 : 400 }}
                  title={`${layer.label} — click to make active`}
                  onClick={() => setActiveLayer(layer.id)}
                >
                  {layer.label}
                </button>
                <button
                  className="shrink-0"
                  style={{ color: 'var(--ink-faint)' }}
                  title="Layer settings"
                  aria-label="Layer settings"
                >
                  <MoreHorizontal size={14} />
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget top bar — defines the widget's upper edge; holds the collapse toggle
// and "show" chips for any hidden layers.
// ---------------------------------------------------------------------------

function WidgetTopBar({
  collapsed,
  onToggleCollapsed,
  hidden,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  hidden: Layer[]
}) {
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  return (
    <div className="flex items-center gap-1 pl-1.5 pr-2" style={{ height: TOP_BAR_HEIGHT }}>
      <button
        onClick={onToggleCollapsed}
        className="rounded p-0.5 hover:bg-accent"
        style={{ color: 'var(--ink-muted)' }}
        title={collapsed ? 'Expand layer panel' : 'Collapse layer panel'}
        aria-label={collapsed ? 'Expand layer panel' : 'Collapse layer panel'}
      >
        {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
      </button>

      {hidden.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
            Hidden:
          </span>
          {hidden.map((l) => (
            <button
              key={l.id}
              onClick={() => updateLayer(l.id, { visibility: true })}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
              style={{ color: 'var(--ink-muted)' }}
              title={`Show ${l.label}`}
            >
              <EyeOff size={11} />
              <span className="max-w-[88px] truncate">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormDiagram
// ---------------------------------------------------------------------------

export function FormDiagram() {
  const doc = useDocumentStore((s) => s.document)
  const collapsed = useUIStore((s) => s.headersCollapsed)
  const toggleCollapsed = useUIStore((s) => s.toggleHeadersCollapsed)
  if (!doc) return null

  // Macro-on-top; hidden layers are pulled out of the stack (slot reclaimed).
  const sorted = [...doc.layers].sort((a, b) => b.displayOrder - a.displayOrder)
  const visible = sorted.filter((l) => l.visibility)
  const hidden = sorted.filter((l) => !l.visibility)

  const stackH = stackHeight(visible.length)
  const headerWidth = collapsed ? HEADER_WIDTH_RAIL : HEADER_WIDTH_EXPANDED

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Work area — the widget block bottom-anchors onto the ruler; the empty
          space above belongs to other (future) widgets, not this one. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div>
          <WidgetTopBar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            hidden={hidden}
          />
          <div className="flex w-full" style={{ height: stackH }}>
            <LayerHeaders layers={visible} collapsed={collapsed} />
            <FormLayers layers={visible} />
          </div>
        </div>
      </div>

      {/* Ruler row — offset cell matches header width so zero aligns with spans */}
      <div className="flex shrink-0 border-t" style={{ borderColor: 'var(--hairline)' }}>
        <div
          className="shrink-0 border-r"
          style={{ width: headerWidth, borderColor: 'var(--hairline)' }}
        />
        <div className="min-w-0 flex-1">
          <TimelineAxis />
        </div>
      </div>
    </div>
  )
}
