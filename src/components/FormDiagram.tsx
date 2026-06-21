/**
 * FormDiagram — the analytical work area: the layer-header column, the stack of
 * form layers, and the timeline ruler, composed so they share one horizontal
 * coordinate system.
 *
 * Alignment invariant (Phase 0.4 §1 / Phase 0.7 §2): the ruler's zero begins at
 * the same x as the left edge of the span content area. Both the layer stack and
 * the ruler sit to the right of a fixed-width header column, each filling the
 * remaining width — so their content areas are identical in width and origin,
 * and a span at time t lines up with tick t below it.
 *
 * Layer stacking order: macro-on-top. Layers render highest-displayOrder first
 * (top of the stack) down to lowest — large-scale form above sections above
 * phrase material — matching the BriFormer reading and the spec §2 sketch.
 */

import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { TimelineAxis } from './TimelineAxis'
import { FormLayers } from './FormLayers'
import { LAYER_PITCH, STACK_TOP_PAD, stackHeight } from '@/lib/formShape'
import type { Layer } from '@/types/strata'

const HEADER_WIDTH = 118 // px — fixed offset column; ruler begins after this

// ---------------------------------------------------------------------------
// Header icons
// ---------------------------------------------------------------------------

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" />
      <circle cx="8" cy="8" r="2" />
      {!open && <line x1="2" y1="2" x2="14" y2="14" />}
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="13" cy="8" r="1.4" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Layer header column
// ---------------------------------------------------------------------------

function LayerHeaders({ layers }: { layers: Layer[] }) {
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const visibleLayers = layers.filter((l) => l.visibility)

  return (
    <div
      className="shrink-0 border-r"
      style={{ width: HEADER_WIDTH, borderColor: 'var(--hairline)' }}
    >
      {/* Spacer matching the stack's top headroom so header rows line up with shapes */}
      <div style={{ height: STACK_TOP_PAD }} />
      {visibleLayers.map((layer) => {
        const active = layer.id === activeLayerId
        return (
          <div
            key={layer.id}
            style={{ height: LAYER_PITCH }}
            className="relative flex items-center gap-1.5 pl-2.5 pr-1.5"
          >
            {/* Active-layer accent bar (load-bearing per 0.4 §2 — spacebar target) */}
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-0 h-full w-[2.5px]"
                style={{ backgroundColor: 'hsl(var(--primary))' }}
              />
            )}
            <button
              className="shrink-0"
              style={{ color: layer.visibility ? 'var(--ink-muted)' : 'var(--ink-faint)' }}
              title={layer.visibility ? 'Hide layer' : 'Show layer'}
              aria-label={layer.visibility ? 'Hide layer' : 'Show layer'}
            >
              <EyeIcon open={layer.visibility} />
            </button>
            <span
              className="min-w-0 flex-1 truncate text-[11px]"
              style={{
                color: 'var(--ink-primary)',
                fontWeight: active ? 500 : 400,
              }}
              title={layer.label}
            >
              {layer.label}
            </span>
            <button
              className="shrink-0"
              style={{ color: 'var(--ink-faint)' }}
              title="Layer settings"
              aria-label="Layer settings"
            >
              <DotsIcon />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FormDiagram
// ---------------------------------------------------------------------------

export function FormDiagram() {
  const doc = useDocumentStore((s) => s.document)
  if (!doc) return null

  // Macro-on-top: highest displayOrder renders at the top of the stack.
  const layers = [...doc.layers].sort((a, b) => b.displayOrder - a.displayOrder)
  const stackH = stackHeight(layers.filter((l) => l.visibility).length)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Work area — the layer stack is bottom-anchored so it sits flush on the
          ruler; empty room for additional layers accumulates above (widgets
          stack upward on the timeline). */}
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
        <div className="flex w-full" style={{ height: stackH }}>
          <LayerHeaders layers={layers} />
          <FormLayers layers={layers} />
        </div>
      </div>

      {/* Ruler row — offset cell matches header width so zero aligns with spans */}
      <div className="flex shrink-0 border-t" style={{ borderColor: 'var(--hairline)' }}>
        <div
          className="shrink-0 border-r"
          style={{ width: HEADER_WIDTH, borderColor: 'var(--hairline)' }}
        />
        <div className="min-w-0 flex-1">
          <TimelineAxis />
        </div>
      </div>
    </div>
  )
}
