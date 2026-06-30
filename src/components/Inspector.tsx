/**
 * Inspector — the app-level right-hand detail panel.
 *
 * A persistent, full-height, collapsible column to the right of the work area; it
 * pushes the diagram, transport, and video to the left. Its CONTENT is contextual:
 * for v1 it hosts the form-diagram's span MetadataPanel. As more widgets arrive,
 * the host mounts the active widget's contextual edit UI here instead.
 *
 * The Inspector owns the chrome — width, border, full height, internal scroll, and
 * the collapse toggle. The content component (MetadataPanel) renders only fields,
 * so the panel can never overrun the shell and collide with the player again.
 */

import { PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { MetadataPanel } from './MetadataPanel'

const PANEL_WIDTH = 288
const RAIL_WIDTH = 32

export function Inspector({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const count = useUIStore((s) => s.selectedSpanIds.length)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const hasSelection = count > 0
  const title = !hasSelection ? 'Inspector' : count === 1 ? 'Span' : `${count} spans`

  if (collapsed) {
    return (
      <div
        className="flex shrink-0 flex-col items-center border-l bg-card pt-2"
        style={{ width: RAIL_WIDTH, borderColor: 'var(--hairline)' }}
      >
        <button
          onClick={onToggle}
          className="rounded p-1 hover:bg-accent"
          style={{ color: 'var(--ink-muted)' }}
          title="Expand inspector"
          aria-label="Expand inspector"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>
    )
  }

  return (
    <aside
      className="flex shrink-0 flex-col border-l bg-card"
      style={{ width: PANEL_WIDTH, borderColor: 'var(--hairline)' }}
    >
      {/* Single header — collapse toggle, contextual title, and deselect. */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-2 py-2"
        style={{ borderColor: 'var(--hairline)' }}
      >
        <button
          onClick={onToggle}
          className="rounded p-0.5 hover:bg-accent"
          style={{ color: 'var(--ink-muted)' }}
          title="Collapse inspector"
          aria-label="Collapse inspector"
        >
          <PanelRightClose size={16} />
        </button>
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="flex-1" />
        {hasSelection && (
          <button
            onClick={() => {
              clearSelection()
              onToggle()
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Deselect and collapse"
            aria-label="Deselect and collapse"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Contextual content — owns the scroll so it can be arbitrarily long. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {hasSelection ? (
          <MetadataPanel />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
              Select a span to see and edit its details.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
