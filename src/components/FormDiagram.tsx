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

import { useRef, useState } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useTimeline } from '@/hooks/useTimeline'
import { computeFitZoom } from '@/lib/timeline'
import { TimelineAxis } from './TimelineAxis'
import { FormLayers } from './FormLayers'
import { LayerSettingsPopover } from './LayerSettingsPopover'
import { AddLayerPopover } from './AddLayerPopover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STACK_TOP_PAD, stackHeight, layerPitch } from '@/lib/formShape'
import type { Layer, FormDiagramData } from '@/types/strata'

const HEADER_WIDTH_EXPANDED = 140
const HEADER_WIDTH_RAIL = 34
const TOP_BAR_HEIGHT = 24

// ---------------------------------------------------------------------------
// Layer header column (visible layers only — hidden ones live in the top bar)
// ---------------------------------------------------------------------------

const HOVER_LABEL_DELAY = 400 // ms of hover before the rail reveals a label

/**
 * One draggable layer header row. Extracted as a component so each can call
 * useSortable (hooks can't run inside a map). Owns its own rename + hover state —
 * both are inherently per-row, and only one row edits at a time. Drag is offered
 * only in the expanded state (the rail is too narrow for a handle); in the rail
 * the row keeps click-to-activate and hover-to-reveal.
 */
function SortableLayerHeaderRow({
  layer,
  active,
  collapsed,
  onRequestDelete,
}: {
  layer: Layer
  active: boolean
  collapsed: boolean
  onRequestDelete: () => void
}) {
  const setActiveLayer = useUIStore((s) => s.setActiveLayer)
  const updateLayer = useDocumentStore((s) => s.updateLayer)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: layer.id })

  // Inline rename (desktop, expanded only — per 0.4 §2/§6): double-click the name
  // to edit; Enter/blur commits, Escape cancels, empty draft is treated as cancel.
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  function startRename() {
    setDraft(layer.label)
    setEditing(true)
  }
  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed) updateLayer(layer.id, { label: trimmed })
    setEditing(false)
  }

  // Hover-intent label reveal for the collapsed rail.
  const [hoverLabel, setHoverLabel] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function armHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHoverLabel(true), HOVER_LABEL_DELAY)
  }
  function disarmHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setHoverLabel(false)
  }

  const style: React.CSSProperties = {
    height: layerPitch(layer),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
    // Background tint (in addition to the accent bar below) — a thin 2.5px
    // edge bar reads as decorative in peripheral vision during fast
    // annotation; a full-row tint is what actually answers "which layer am I
    // about to place a boundary in?" at a glance. Matches the original 0.4 §2
    // spec ("left accent bar, background tint, or similar") — only the bar
    // half of that was built.
    backgroundColor: active ? 'hsl(var(--primary) / 0.07)' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={collapsed ? () => setActiveLayer(layer.id) : undefined}
      onMouseEnter={collapsed ? armHover : undefined}
      onMouseLeave={collapsed ? disarmHover : undefined}
      className={`flex items-center ${collapsed ? 'cursor-pointer justify-center' : 'gap-1 pl-1 pr-1.5'}`}
    >
      {/* Active-layer accent bar (load-bearing per 0.4 §2 — spacebar target) */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[2.5px]"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        />
      )}

      {/* Hover-reveal label tooltip (collapsed rail only) */}
      {collapsed && hoverLabel && (
        <span
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded px-2 py-1 text-[11px] text-white shadow-md"
          style={{ backgroundColor: 'var(--ink-primary)' }}
          role="tooltip"
        >
          {layer.label}
        </span>
      )}

      {collapsed ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            updateLayer(layer.id, { visibility: false })
          }}
          className="shrink-0 hover:opacity-80"
          style={{ color: 'var(--ink-muted)' }}
          title="Hide layer"
          aria-label="Hide layer"
        >
          <Eye size={14} />
        </button>
      ) : (
        <>
          {/* Drag handle — reorder by displayOrder. */}
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 touch-none cursor-grab active:cursor-grabbing hover:opacity-100"
            style={{ color: 'var(--ink-faint)', opacity: 0.6 }}
            title="Drag to reorder"
            aria-label="Drag to reorder layer"
          >
            <GripVertical size={13} />
          </button>
          <button
            onClick={() => updateLayer(layer.id, { visibility: false })}
            className="shrink-0 hover:opacity-80"
            style={{ color: 'var(--ink-muted)' }}
            title="Hide layer"
            aria-label="Hide layer"
          >
            <Eye size={14} />
          </button>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setEditing(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border bg-white px-1 text-[11px] outline-none"
              style={{ borderColor: 'hsl(var(--primary))', color: 'var(--ink-primary)' }}
            />
          ) : (
            <button
              className="min-w-0 flex-1 truncate text-left text-[11px]"
              style={{ color: 'var(--ink-primary)', fontWeight: active ? 500 : 400 }}
              title={`${layer.label} — click to make active, double-click to rename`}
              onClick={() => setActiveLayer(layer.id)}
              onDoubleClick={startRename}
            >
              {layer.label}
            </button>
          )}
          <LayerSettingsPopover layer={layer} onRequestDelete={onRequestDelete} />
        </>
      )}
    </div>
  )
}

function LayerHeaders({ layers, collapsed }: { layers: Layer[]; collapsed: boolean }) {
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const removeLayer = useDocumentStore((s) => s.removeLayer)
  const reorderLayers = useDocumentStore((s) => s.reorderLayers)
  const width = collapsed ? HEADER_WIDTH_RAIL : HEADER_WIDTH_EXPANDED

  // Delete confirmation is owned here, not inside each layer's settings popover:
  // confirming removes the layer, which would unmount a dialog nested in that row
  // mid-close (Radix throws). One hoisted dialog, keyed by the pending layer.
  const [pendingDelete, setPendingDelete] = useState<Layer | null>(null)
  const pendingSpanCount = pendingDelete
    ? (pendingDelete.data as FormDiagramData).spans.length
    : 0
  function confirmDelete() {
    if (pendingDelete) removeLayer(pendingDelete.id)
    setPendingDelete(null)
  }

  // A small distance threshold so a click on the grip doesn't register as a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = layers.map((l) => l.id) // current top-to-bottom order
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    reorderLayers(arrayMove(ids, from, to))
  }

  return (
    <div className="shrink-0 border-r" style={{ width, borderColor: 'var(--hairline)' }}>
      {/* Top headroom matching the stack so header rows align with the shapes */}
      <div style={{ height: STACK_TOP_PAD }} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {layers.map((layer) => (
            <SortableLayerHeaderRow
              key={layer.id}
              layer={layer}
              active={layer.id === activeLayerId}
              collapsed={collapsed}
              onRequestDelete={() => setPendingDelete(layer)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Single delete-confirm dialog, hoisted out of the per-layer popovers so
          removing the layer never unmounts an open dialog's own subtree. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the layer and its {pendingSpanCount}{' '}
              {pendingSpanCount === 1 ? 'span' : 'spans'} from the analysis. You can
              undo this with Ctrl/Cmd+Z.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
            >
              Delete layer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zoom controls — live in the widget top bar (right side) rather than floating
// over the ruler's time labels. − / 100% (reset to standard scale) / + / Fit.
// ---------------------------------------------------------------------------

interface ZoomControlProps {
  zoom: number
  minZoomValue: number
  maxZoomValue: number
  zoomIn: () => void
  zoomOut: () => void
  resetTo100: () => void
  fitToWindow: () => void
  isFit: boolean
}

/** Small +/− icon button with a disabled (faded) state. */
function ZoomButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center rounded hover:bg-accent disabled:cursor-default"
      style={{
        width: 16,
        height: 16,
        fontSize: 13,
        lineHeight: 1,
        color: disabled ? 'var(--ink-faint)' : 'var(--ink-secondary)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
      }}
    >
      {children}
    </button>
  )
}

function ZoomControls({
  zoom,
  minZoomValue,
  maxZoomValue,
  zoomIn,
  zoomOut,
  resetTo100,
  fitToWindow,
  isFit,
}: ZoomControlProps) {
  return (
    <div className="flex items-center gap-0.5" style={{ color: 'var(--ink-secondary)' }}>
      <ZoomButton onClick={zoomOut} disabled={zoom <= minZoomValue + 1e-6} label="Zoom out">
        −
      </ZoomButton>
      <button
        onClick={resetTo100}
        aria-label="Current zoom level — click to reset to 100%"
        title="Reset to 100% (standard scale)"
        className="rounded px-1 hover:bg-accent"
        style={{
          minWidth: 32,
          height: 16,
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink-secondary)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          textAlign: 'center',
        }}
      >
        {Math.round(zoom * 100)}%
      </button>
      <ZoomButton onClick={zoomIn} disabled={zoom >= maxZoomValue - 1e-6} label="Zoom in">
        +
      </ZoomButton>
      <span
        aria-hidden
        style={{ width: 1, height: 12, background: 'var(--hairline)', margin: '0 2px' }}
      />
      {/* Labeled with the state a click would switch TO, not the current
          state — already at fit, so this offers "100%" instead of a
          redundant "Fit". */}
      <button
        onClick={isFit ? resetTo100 : fitToWindow}
        aria-label={isFit ? 'Reset to 100%' : 'Fit to window'}
        title={isFit ? 'Reset to 100% (standard scale)' : 'Fit the whole track to the window'}
        className="rounded px-1 hover:bg-accent"
        style={{
          height: 16,
          fontSize: 10,
          color: 'var(--ink-secondary)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
        }}
      >
        {isFit ? '100%' : 'Fit'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget top bar — defines the widget's upper edge; holds the collapse toggle,
// "show" chips for any hidden layers, and the timeline zoom controls (right).
// ---------------------------------------------------------------------------

function WidgetTopBar({
  collapsed,
  onToggleCollapsed,
  hidden,
  zoom,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  hidden: Layer[]
  zoom: ZoomControlProps
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

      <AddLayerPopover />

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

      <div className="ml-auto">
        <ZoomControls {...zoom} />
      </div>
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
  const selectedMarkerId = useUIStore((s) => s.selectedPointMarkerId)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const addPointMarker = useDocumentStore((s) => s.addPointMarker)
  const updatePointMarker = useDocumentStore((s) => s.updatePointMarker)
  // Timeline state lives here so the zoom controls can render in the widget top
  // bar while the ruler (TimelineAxis) renders below. One shared instance.
  const timeline = useTimeline()
  if (!doc) return null

  const fitZoom = computeFitZoom(timeline.duration, timeline.viewportWidth)
  const zoomProps = {
    zoom: timeline.zoom,
    minZoomValue: timeline.minZoomValue,
    maxZoomValue: timeline.maxZoomValue,
    zoomIn: timeline.zoomIn,
    zoomOut: timeline.zoomOut,
    resetTo100: timeline.resetTo100,
    fitToWindow: timeline.fitToWindow,
    isFit: Math.abs(timeline.zoom - fitZoom) < 1e-3,
  }

  // Macro-on-top; hidden layers are pulled out of the stack (slot reclaimed).
  const sorted = [...doc.layers].sort((a, b) => b.displayOrder - a.displayOrder)
  const visible = sorted.filter((l) => l.visibility)
  const hidden = sorted.filter((l) => !l.visibility)

  const stackH = stackHeight(visible)
  const headerWidth = collapsed ? HEADER_WIDTH_RAIL : HEADER_WIDTH_EXPANDED

  return (
    // px-2 insets the whole diagram (widget card + ruler) together, so the
    // ruler↔span alignment invariant is unaffected by the framing. The diagram
    // is BOTTOM-anchored (justify-end): the widget card + ruler sit just above the
    // transport, and the extra vertical room accumulates ABOVE — that blank space
    // is where additional widgets will stack as they're added.
    <div className="flex min-h-0 flex-1 flex-col justify-end px-2 pb-1">
      {/* Empty-canvas affordance: a quiet hint filling exactly the leftover
          space above the widget card (flex-1, so it vanishes once a tall
          layer stack claims that room). Explains the blank space is
          intentional — reserved for future widgets — rather than reading as
          unfinished. overflow-hidden so it clips cleanly instead of forcing
          height when the stack leaves almost no room. */}
      <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden">
        <p
          className="select-none text-xs"
          style={{ color: 'var(--ink-faint)', opacity: 0.6 }}
        >
          More analytical layers will stack here as they're added
        </p>
      </div>

      {/* The widget is a framed card: the top bar (collapse / add / hidden
          chips) and the layer stack read as one object distinct from the shared
          timeline below. The border overlay (absolute, pointer-events-none, z-10)
          paints above the absolutely-positioned FormLayers SVG so all four edges
          are visible — an inset outline would be covered by the SVG on bottom/right. */}
      <div
        className="relative shrink-0 overflow-hidden rounded-md bg-[var(--canvas)]"
        style={{ marginBottom: 4 }}
      >
        <WidgetTopBar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          hidden={hidden}
          zoom={zoomProps}
        />
        <div className="flex w-full" style={{ height: stackH }}>
          <LayerHeaders layers={visible} collapsed={collapsed} />
          <FormLayers layers={visible} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{ border: '1px solid var(--ruler)' }}
        />
      </div>

      {/* Ruler row — offset cell matches header width so zero aligns with spans */}
      <div className="flex shrink-0 border-t" style={{ borderColor: 'var(--hairline)' }}>
        <div
          className="shrink-0 border-r"
          style={{ width: headerWidth, borderColor: 'var(--hairline)' }}
        />
        <div className="min-w-0 flex-1">
          <TimelineAxis
            containerRef={timeline.containerRef}
            pps={timeline.pps}
            totalWidth={timeline.totalWidth}
            scrollOffset={timeline.scrollOffset}
            viewportWidth={timeline.viewportWidth}
            currentTime={timeline.currentTime}
            duration={timeline.duration}
            setScrollOffset={timeline.setScrollOffset}
            pointMarkers={doc.pointMarkers}
            sharedTimePoints={doc.sharedTimePoints}
            selectedMarkerId={selectedMarkerId}
            onSelectMarker={selectPointMarker}
            onPlaceMarker={(time) => {
              const id = crypto.randomUUID()
              addPointMarker({ id, timestamp: time })
              selectPointMarker(id)
            }}
            onMoveMarker={(id, time) => updatePointMarker(id, { timestamp: time })}
          />
        </div>
      </div>
    </div>
  )
}
