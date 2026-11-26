/**
 * WorkArea — the segmentation *widget*: a bounded block of a widget top bar,
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

import { useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  GripVertical,
  Navigation,
  Plus,
  Trash2,
} from 'lucide-react'
import { TempoBlock } from '@/widgets/tempo/TempoBlock'
import { BarsMenu } from '@/components/BarsMenu'
import { NormalizeMode } from '@/components/NormalizePanel'
import { MENU_TRIGGER } from '@/lib/toolRow'
import { WIDGET_NAMES, widgetBlocks } from '@/lib/widgets'
import { tempoSummary } from '@/lib/tempoLane'
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
import { useUIStore, type QuickEntry } from '@/store/uiStore'
import { useTimeline } from '@/hooks/useTimeline'
import { computeFitZoom, computePps, offsetShowing, scrollableWidth, timeInView } from '@/lib/timeline'
import { TimelineAxis } from './TimelineAxis'
import { SegmentLayers } from './SegmentLayers'
import { LayerSettingsPopover } from './LayerSettingsPopover'
import { AddLayerPopover } from './AddLayerPopover'
import { DiagramControlBar } from './DiagramControlBar'
import { GridPopover } from './GridPopover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { QuickSetup } from './QuickSetup'
import { VIDEO_MINI_WIDTH } from './PlayerDock'
import { CommentaryPanel } from '@/widgets/written-analysis/CommentaryPanel'
import { segmentSpans, analysisLayers, quickSetupLayer } from '@/lib/layers'
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
import { STACK_TOP_PAD, stackHeight, layerPitch } from '@/lib/segmentShape'
import { markerBandHeight } from '@/lib/markerBand'
import { HEADER_WIDTH_RAIL, layerHeaderWidth, measureLabel } from '@/lib/layerHeader'
import type { BlockType, Layer, WidgetBlock } from '@/types/strata'
import { usePhone } from '@/hooks/usePhone'

const TOP_BAR_HEIGHT = 24
// The most of a phone's screen the layer stack takes in the reading view; past
// it the layers scroll. A third of the screen leaves room for the video, what's
// playing and the play bar, however many layers an analysis has.
const PHONE_STACK_MAX = '35dvh'

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
  const reading = useUIStore((s) => s.readingView)

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

  // Reading: the level's name, and an eye that hides it from this view only
  // (uiStore.readingHiddenLayers); the file is untouched. On a phone it frees
  // room for the rest.
  if (reading)
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, backgroundColor: undefined }}
        className={`flex items-center ${collapsed ? 'justify-center' : 'gap-1 pl-1.5 pr-2'}`}
      >
        <button
          onClick={() => useUIStore.getState().setReadingLayerHidden(layer.id, true)}
          className="shrink-0 hover:opacity-80"
          style={{ color: 'var(--ink-muted)' }}
          title={`Hide ${layer.label || 'this layer'}`}
          aria-label={`Hide ${layer.label || 'this layer'}`}
        >
          <Eye size={14} />
        </button>
        {!collapsed && (
          <span className="truncate text-xs" style={{ color: 'var(--ink-primary)' }}>
            {layer.label}
          </span>
        )}
      </div>
    )

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={collapsed ? () => setActiveLayer(layer.id) : undefined}
      onMouseEnter={collapsed ? armHover : undefined}
      onMouseLeave={collapsed ? disarmHover : undefined}
      className={`flex items-center ${collapsed ? 'cursor-pointer justify-center' : 'gap-1 pl-1 pr-1.5'}`}
    >
      {/* Active-layer accent bar (load-bearing per 0.4 §2 — boundary-key (B) target) */}
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
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded px-2 py-1 text-xs text-white shadow-md"
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
            style={{ color: 'var(--ink-muted)' }}
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
              className="min-w-0 flex-1 rounded border bg-white px-1 text-xs outline-hidden"
              style={{ borderColor: 'hsl(var(--primary))', color: 'var(--ink-primary)' }}
            />
          ) : (
            <button
              className="min-w-0 flex-1 truncate text-left text-xs"
              style={{ color: 'var(--ink-primary)', fontWeight: active ? 500 : 400 }}
              title={`${layer.label}. Click to make active; double-click to rename.`}
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

function LayerHeaders({ layers, collapsed, width }: { layers: Layer[]; collapsed: boolean; width: number }) {
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const removeLayer = useDocumentStore((s) => s.removeLayer)
  const reorderLayers = useDocumentStore((s) => s.reorderLayers)

  // Delete confirmation is owned here, not inside each layer's settings popover:
  // confirming removes the layer, which would unmount a dialog nested in that row
  // mid-close (Radix throws). One hoisted dialog, keyed by the pending layer.
  const [pendingDelete, setPendingDelete] = useState<Layer | null>(null)
  const pendingSpanCount = pendingDelete ? segmentSpans(pendingDelete).length : 0
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
              This deletes the layer and its {pendingSpanCount}{' '} {pendingSpanCount === 1 ? 'span' : 'spans'}. Undo with Ctrl/⌘+Z.
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

/**
 * Back to the playhead: shown only while the playhead is off screen, which,
 * since following leaves a view the reader scrolled away (decisions.md,
 * "Following the Playhead"), is when they need a way back. Brings the playhead
 * in at 20%, where a seek lands; while playing, following carries on from there.
 */
function PlayheadButton() {
  // A boolean, so the bar re-renders only when the playhead leaves or comes
  // back, not on every time update.
  const away = useUIStore(
    (s) => !timeInView({ time: s.currentTime, pps: computePps(s.zoom), viewportWidth: s.viewportWidth, scrollOffset: s.scrollOffset }),
  )
  if (!away) return null
  function goBack() {
    const ui = useUIStore.getState()
    const duration = useDocumentStore.getState().document?.duration ?? 0
    ui.setScrollOffset(
      offsetShowing({ time: ui.currentTime, pps: computePps(ui.zoom), viewportWidth: ui.viewportWidth, totalWidth: scrollableWidth(duration, ui.zoom) }),
    )
  }
  return (
    <button
      type="button"
      onClick={goBack}
      title="Back to the playhead"
      aria-label="Back to the playhead"
      // A map app's "back to me" arrow, alone, like its locate button.
      className="mr-1 flex h-5 w-5 items-center justify-center rounded hover:bg-accent"
      style={{ color: 'var(--ink-secondary)' }}
    >
      <Navigation size={12} aria-hidden />
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
      <PlayheadButton />
      <ZoomButton onClick={zoomOut} disabled={zoom <= minZoomValue + 1e-6} label="Zoom out">
        −
      </ZoomButton>
      <span
        aria-label="Zoom level"
        style={{ minWidth: 32, fontSize: 10, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}
      >
        {Math.round(zoom * 100)}%
      </span>
      <ZoomButton onClick={zoomIn} disabled={zoom >= maxZoomValue - 1e-6} label="Zoom in">
        +
      </ZoomButton>
      <span
        aria-hidden
        style={{ width: 1, height: 12, background: 'var(--hairline)', margin: '0 2px' }}
      />
      {/* Fit and 100% as a pair, the current one marked, so the control
          shows where you are rather than a second, puzzling percentage. */}
      <div className="flex overflow-hidden rounded border" style={{ borderColor: 'var(--hairline)' }}>
        {([
          ['Fit', isFit, fitToWindow, 'Fit the whole track to the window'],
          ['100%', !isFit && Math.abs(zoom - 1) < 1e-6, resetTo100, 'Standard scale'],
        ] as const).map(([label, on, act, title]) => (
          <button
            key={label}
            onClick={act}
            title={title}
            aria-pressed={on}
            className={on ? 'bg-accent px-1.5 font-medium' : 'px-1.5 hover:bg-accent/60'}
            style={{ height: 16, fontSize: 10, color: on ? 'var(--ink-primary)' : 'var(--ink-secondary)' }}
          >
            {label}
          </button>
        ))}
      </div>
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
  blockControls,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  hidden: Layer[]
  zoom: ZoomControlProps
  blockControls?: ReactNode
}) {
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  // Two rows (docs/decisions.md, "Where Controls Live"): the block's name and
  // view, then its tools. This bar is only drawn while editing; reading has its
  // own one-row bar.
  return (
    <div className="flex flex-col">
    <div className="flex items-center gap-1 pl-1.5 pr-2" style={{ height: TOP_BAR_HEIGHT }}>
      <button
        onClick={onToggleCollapsed}
        className="rounded p-0.5 hover:bg-accent"
        style={{ color: 'var(--ink-muted)' }}
        title={collapsed ? 'Expand layer names' : 'Collapse layer names'}
        aria-label={collapsed ? 'Expand layer names' : 'Collapse layer names'}
      >
        {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
      </button>
      <span className="mr-1 text-[12px] font-medium" style={{ color: 'var(--ink-primary)' }}>
        Segments
      </span>

      {hidden.length > 0 && (
        <div className="flex items-center gap-1 overflow-hidden">
          <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Hidden:
          </span>
          {hidden.map((l) => (
            <button
              key={l.id}
              onClick={() => updateLayer(l.id, { visibility: true })}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-accent"
              style={{ color: 'var(--ink-muted)' }}
              title={`Show ${l.label}`}
            >
              <EyeOff size={11} />
              <span className="max-w-[88px] truncate">{l.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <ZoomControls {...zoom} />
        {blockControls}
      </div>
    </div>
    {/* The tool row: about six things (docs/decisions.md, "Where Controls Live"). */}
    <div
      className="flex flex-wrap items-center gap-1.5 border-t px-2 py-1"
      style={{ borderColor: 'var(--hairline)', background: 'var(--guide-faint)' }}
    >
      <DiagramControlBar />
      <span aria-hidden style={{ width: 1, height: 14, background: 'var(--hairline)', margin: '0 2px' }} />
      <AddLayerPopover />
      <GridPopover />
      <BarsMenu />
      <QuickEntrySwitch />
    </div>
    <NormalizeMode />
    </div>
  )
}

/**
 * A block's own controls, at the right of its top bar (lib/widgets.ts): move
 * it up or down, hide it, and, for any block but the Segments block, remove it.
 * Moving shows only when there is another block to move past.
 */
function BlockControls({ type, index, count }: { type: BlockType; index: number; count: number }) {
  const moveWidget = useDocumentStore((s) => s.moveWidget)
  const setWidgetHidden = useDocumentStore((s) => s.setWidgetHidden)
  const removeWidget = useDocumentStore((s) => s.removeWidget)
  const [confirming, setConfirming] = useState(false)
  const name = WIDGET_NAMES[type]
  const icon = 'flex h-5 w-5 items-center justify-center rounded hover:bg-accent disabled:opacity-30 disabled:hover:bg-transparent'
  const style = { color: 'var(--ink-muted)' }
  return (
    <span className="flex items-center gap-0.5">
      {count > 1 && (
        <>
          <span aria-hidden style={{ width: 1, height: 12, background: 'var(--hairline)', margin: '0 3px' }} />
          <button className={icon} style={style} disabled={index === 0} onClick={() => moveWidget(type, -1)} title={`Move ${name} up`} aria-label={`Move ${name} up`}>
            <ArrowUp size={13} />
          </button>
          <button className={icon} style={style} disabled={index === count - 1} onClick={() => moveWidget(type, 1)} title={`Move ${name} down`} aria-label={`Move ${name} down`}>
            <ArrowDown size={13} />
          </button>
        </>
      )}
      <button className={icon} style={style} onClick={() => setWidgetHidden(type, true)} title={`Hide ${name}`} aria-label={`Hide ${name}`}>
        <EyeOff size={13} />
      </button>
      {type !== 'segmentation' &&
        (confirming ? (
          <span className="flex items-center gap-1 text-[11px]" style={style}>
            Remove {name}?
            <button className="rounded px-1 hover:bg-accent" style={{ color: 'hsl(var(--destructive))' }} onClick={() => removeWidget(type)}>
              Remove
            </button>
            <button className="rounded px-1 hover:bg-accent" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button className={icon} style={style} onClick={() => setConfirming(true)} title={`Remove ${name}`} aria-label={`Remove ${name}`}>
            <Trash2 size={13} />
          </button>
        ))}
    </span>
  )
}

/**
 * Above the blocks, in the editor: the hidden blocks, each brought back with
 * a click, and Add widget. When the Segments block is hidden, the zoom controls
 * it carries come here. Nothing shows while every block is shown and nothing
 * more can be added, so the strip costs no room most of the time.
 */
function WidgetStrip({ blocks, zoom }: { blocks: WidgetBlock[]; zoom: ZoomControlProps | null }) {
  const setWidgetHidden = useDocumentStore((s) => s.setWidgetHidden)
  const addTempoWidget = useDocumentStore((s) => s.addTempoWidget)
  const hasBars = useDocumentStore((s) => !!s.document?.layers.some((l) => l.role === 'bars' && l.type === 'segmentation'))
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const hidden = blocks.filter((w) => w.hidden && w.type in WIDGET_NAMES)
  const canAddTempo = !blocks.some((w) => w.type === 'tempo')
  if (!hidden.length && !canAddTempo && !zoom) return null
  const offer = canAddTempo ? <TempoOffer /> : null
  const chip = 'flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-accent'
  return (
    <div className="flex shrink-0 items-center gap-1 pb-1" style={{ color: 'var(--ink-muted)' }}>
      {hidden.length > 0 && <span className="text-[11px]">Hidden:</span>}
      {hidden.map((w) => (
        <button key={w.type} className={chip} onClick={() => setWidgetHidden(w.type, false)} title={`Show ${WIDGET_NAMES[w.type]}`}>
          <Eye size={11} />
          {WIDGET_NAMES[w.type]}
        </button>
      ))}
      {canAddTempo && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className={chip} title="Add a widget: another kind of analysis on the same timeline">
              <Plus size={11} />
              Add widget
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-1 p-2 text-[13px]">
            <button
              className="flex flex-col items-start rounded px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
              disabled={!hasBars}
              onClick={() => {
                if (addTempoWidget()) setOpen(false)
                else setNote('Make a layer the bar layer first (its ⋯ menu).')
              }}
            >
              <span style={{ color: 'var(--ink-primary)' }}>Tempo</span>
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                {hasBars ? 'Each bar’s tempo, read from the bar layer.' : 'Needs a bar layer: turn one on in a layer’s ⋯ menu.'}
              </span>
            </button>
            {note && <p className="px-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>{note}</p>}
          </PopoverContent>
        </Popover>
      )}
      {offer}
      {zoom && (
        <div className="ml-auto">
          <ZoomControls {...zoom} />
        </div>
      )}
    </div>
  )
}

/**
 * Just after a layer becomes the bar layer: Tempo offered if the bars' tempo
 * moves, or a note that it's steady (lib/tempoLane.ts tempoSummary; more than
 * TEMPO_MOVES_BPM). Nothing is added unasked (docs/decisions.md, "Where
 * Controls Live").
 */
function TempoOffer() {
  const layerId = useUIStore((s) => s.tempoOffer)
  const setTempoOffer = useUIStore((s) => s.setTempoOffer)
  const doc = useDocumentStore((s) => s.document)
  const addTempoWidget = useDocumentStore((s) => s.addTempoWidget)
  const layer = layerId ? doc?.layers.find((l) => l.id === layerId && l.role === 'bars') : null
  const summary = doc && layer ? tempoSummary(doc, layer) : null
  if (!summary) return null
  const r = (x: number) => Math.round(x)
  const show = () => {
    addTempoWidget()
    setTempoOffer(null)
  }
  const chip = 'rounded border px-1.5 py-0.5 text-[11px] hover:bg-accent'
  return (
    <span
      role="status"
      className="ml-2 flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px]"
      style={summary.moves ? { background: 'var(--ink-primary)', color: 'var(--canvas)' } : { background: 'var(--guide-faint)', color: 'var(--ink-secondary)' }}
    >
      {summary.moves ? `Tempo moves from ${r(summary.low)} to ${r(summary.high)} BPM across these bars.` : `Steady at ${r(summary.median)} BPM.`}
      <button type="button" className={chip} style={{ borderColor: 'currentColor' }} onClick={show}>
        {summary.moves ? 'Show Tempo' : 'Show Tempo anyway'}
      </button>
      <button type="button" className={chip} style={{ borderColor: 'transparent' }} onClick={() => setTempoOffer(null)} aria-label="Not now">
        {summary.moves ? 'Not now' : '×'}
      </button>
    </span>
  )
}

/**
 * What the quick-entry bar offers for the selected spans (QuickEntryBar.tsx):
 * types, shapes, fills, or nothing. Remembered in the browser. Named "Quick
 * pick" on screen, with each choice described, since a bare Off / Type /
 * Shape / Fill switch didn't say what it switched.
 */
const QUICK_PICK: [QuickEntry, string, string][] = [
  ['type', 'Types', 'The layer’s span types, such as Verse or Chorus.'],
  ['shape', 'Shapes', 'How each end and the line look.'],
  ['fill', 'Fills', 'A fill color.'],
  ['off', 'Off', 'Nothing pops up.'],
]

function QuickEntrySwitch() {
  const mode = useUIStore((s) => s.quickEntry)
  const setMode = useUIStore((s) => s.setQuickEntry)
  const current = QUICK_PICK.find(([m]) => m === mode)
  // Controlled, so a pick closes the menu: otherwise the only way out was a
  // click outside it, which on the diagram also cleared the selection.
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Set a type, shape, or fill in one click"
          className={MENU_TRIGGER}
        >
          Quick pick
          <span className="rounded bg-accent px-1 text-[11px] text-foreground">{mode === 'off' ? 'off' : current?.[1].toLowerCase()}</span>
          <ChevronDown size={11} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-2 text-xs">
        {/* How Quick pick works is in Help (?), so the menu is just the choice. */}
        <div className="flex flex-col gap-0.5" role="radiogroup" aria-label="Quick pick offers">
          {QUICK_PICK.map(([m, label, what]) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => {
                setMode(m)
                setOpen(false)
              }}
              title={what}
              className={`rounded px-2 py-1 text-left ${mode === m ? 'bg-accent font-medium text-foreground' : 'text-foreground hover:bg-accent/60'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// WorkArea
// ---------------------------------------------------------------------------

export function WorkArea() {
  const doc = useDocumentStore((s) => s.document)
  const collapsed = useUIStore((s) => s.headersCollapsed)
  const toggleCollapsed = useUIStore((s) => s.toggleHeadersCollapsed)
  // Timeline state lives here so the zoom controls can render in the widget top
  // bar while the ruler (TimelineAxis) renders below. One shared instance.
  const timeline = useTimeline()
  const reading = useUIStore((s) => s.readingView)
  const videoMini = useUIStore((s) => s.videoMini)
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  const showDiagram = useUIStore((s) => !s.readingView || s.readingShow.diagram)
  // On a phone the reading view is one screen shared by bands (what's playing,
  // the diagram, later widgets), each scrolling inside its share; the diagram's
  // layers scroll up and down past PHONE_STACK_MAX while the ruler stays put.
  const embed = useUIStore((s) => s.embed)
  // Layers the reader hid in the reading view (the file's visibility is untouched).
  const readingHidden = useUIStore((s) => s.readingHiddenLayers)
  const phoneReading = usePhone() && reading && !embed
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

  // Widgets as blocks (lib/widgets.ts): the Segments block's card and the other
  // blocks, top to bottom in the file's order, above the one shared ruler.
  const blocks = widgetBlocks(doc)
  const segmentsAt = blocks.findIndex((w) => w.type === 'segmentation')
  const segmentsHidden = !!blocks[segmentsAt]?.hidden
  const renderBlock = (w: WidgetBlock, i: number) =>
    w.type === 'tempo' && !w.hidden ? (
      <TempoBlock
        key="tempo"
        headerWidth={headerWidth}
        reading={reading}
        controls={reading ? undefined : <BlockControls type="tempo" index={i} count={blocks.length} />}
      />
    ) : null

  // Macro-on-top; hidden layers are pulled out of the stack (slot reclaimed).
  // Only segmentation layers draw here. A layer of a type this build doesn't
  // know is kept in the document untouched (the loader warns about it).
  const sorted = doc.layers
    .filter((l) => l.type === 'segmentation')
    .sort((a, b) => b.displayOrder - a.displayOrder)
  const hiddenByReader = (l: Layer) => reading && readingHidden.includes(l.id)
  const visible = sorted.filter((l) => l.visibility && !hiddenByReader(l))
  // Hidden in this view only: each comes back from a chip in the reading bar.
  const readerHid = sorted.filter((l) => l.visibility && hiddenByReader(l))
  // Hidden commentary gets a chip too, so it comes back the same way a hidden
  // layer does (its Hide button is on the commentary itself).
  const hidden = [...sorted.filter((l) => !l.visibility), ...analysisLayers(doc).filter((l) => !l.visibility)]

  // The widget card must also make room for the marker band that SegmentLayers
  // draws below the stack, or the band is clipped by the card.
  const stackH = stackHeight(visible) + markerBandHeight(doc.pointMarkers, doc.vocabulary.pointMarkerTypes, timeline.pps)
  // As wide as the longest visible name needs (lib/layerHeader.ts). Measuring
  // a handful of names is cheap, so it runs each render rather than in a memo
  // (which couldn't sit below the early return above).
  const expandedWidth = layerHeaderWidth(visible.map((l) => l.label), measureLabel, reading ? 'reading' : 'editing')
  const headerWidth = collapsed ? HEADER_WIDTH_RAIL : expandedWidth
  const miniVideo = videoMini && !reading && doc.source.type === 'youtube' && !!doc.source.url
  // A linked analysis with no spans yet gets the quick setup (QuickSetup.tsx).
  const linked = !!doc.source.url || (doc.source.type === 'local' && !!doc.source.filename)
  const quickLayer =
    !reading && linked && !doc.layers.some((l) => segmentSpans(l).length > 0) ? quickSetupLayer(doc, activeLayerId) : null

  return (
    // px-2 insets the whole diagram (widget card + ruler) together, so the
    // ruler↔span alignment invariant is unaffected by the framing. The diagram
    // is BOTTOM-anchored (justify-end): the widget card + ruler sit just above the
    // transport, and the extra vertical room accumulates ABOVE — that blank space
    // is where additional widgets will stack as they're added.
    <div className="flex min-h-0 flex-1 flex-col justify-end px-2 pb-1">
      {/* The open area above the widget card (flex-1, so it shrinks as a tall
          layer stack claims the room). The written-analysis widget reads here;
          with no commentary yet it shows a one-line hint instead. */}
      <div
        className={`relative flex min-h-0 flex-1 overflow-y-auto ${reading ? 'items-start justify-start' : 'items-center justify-center'}`}
        // Keep the commentary out from under the corner mini player (PlayerDock).
        style={miniVideo ? { paddingRight: VIDEO_MINI_WIDTH + 24 } : undefined}
      >
        {/* The written-analysis widget reads here: the commentary for what's
            playing (see widgets/written-analysis/CommentaryPanel). Before
            any span exists, its hint is joined by the quick setup. */}
        {quickLayer ? (
          <div className="flex flex-col items-center">
            <CommentaryPanel />
            <QuickSetup doc={doc} layer={quickLayer} />
          </div>
        ) : (
          <CommentaryPanel />
        )}
      </div>

      {/* The widget is a framed card: the top bar (collapse / add / hidden
          chips) and the layer stack read as one object distinct from the shared
          timeline below. The border overlay (absolute, pointer-events-none, z-10)
          paints above the absolutely-positioned SegmentLayers SVG so all four edges
          are visible — an inset outline would be covered by the SVG on bottom/right. */}
      {/* Reading can hide the diagram; it stays mounted (hidden) so the
          timeline keeps its measurements. */}
      {/* data-touch-pan: a finger drags the diagram sideways here, and only
          here (hooks/useTouchPan). */}
      <div className={showDiagram ? 'contents' : 'hidden'} data-touch-pan>
      {!reading && <WidgetStrip blocks={blocks} zoom={segmentsHidden ? zoomProps : null} />}
      {blocks.slice(0, segmentsAt).map((w, i) => renderBlock(w, i))}
      <div
        data-keeps-selection
        className={`relative shrink-0 overflow-hidden rounded-md bg-(--canvas) ${segmentsHidden ? 'hidden' : ''}`}
        style={{ marginBottom: 4 }}
      >
        {/* Editing controls are off while reading. The reading view keeps
            zoom, so a reader can look closely at a passage and fit the whole
            track again; so does an embed (decisions.md, "Embed Zoom"). */}
        {!reading && (
          <WidgetTopBar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            hidden={hidden}
            zoom={zoomProps}
            blockControls={<BlockControls type="segmentation" index={segmentsAt} count={blocks.length} />}
          />
        )}
        {/* Reading (and an embed) keeps two controls: the layer names'
            collapse, so a reader can give the diagram the room, and zoom. */}
        {reading && (
          <div className="flex shrink-0 items-center border-b px-2" style={{ height: 26, borderColor: 'var(--hairline)' }}>
            <button
              onClick={toggleCollapsed}
              className="rounded p-0.5 hover:bg-accent"
              style={{ color: 'var(--ink-muted)' }}
              title={collapsed ? 'Show layer names' : 'Hide layer names'}
              aria-label={collapsed ? 'Show layer names' : 'Hide layer names'}
            >
              {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            </button>
            {readerHid.length > 0 && (
              <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
                <span className="shrink-0 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                  Hidden:
                </span>
                {readerHid.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => useUIStore.getState().setReadingLayerHidden(l.id, false)}
                    className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-accent"
                    style={{ color: 'var(--ink-muted)' }}
                    title={`Show ${l.label}`}
                  >
                    <EyeOff size={11} />
                    <span className="max-w-[88px] truncate">{l.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto shrink-0">
              <ZoomControls {...zoomProps} />
            </div>
          </div>
        )}
        <div className={phoneReading ? 'overflow-y-auto overscroll-contain' : undefined} style={phoneReading ? { maxHeight: PHONE_STACK_MAX } : undefined}>
          <div className="flex w-full" style={{ height: stackH }}>
            <LayerHeaders layers={visible} collapsed={collapsed} width={headerWidth} />
            <SegmentLayers layers={visible} />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{ border: '1px solid var(--ruler)' }}
        />
      </div>

      {blocks.slice(segmentsAt + 1).map((w, k) => renderBlock(w, segmentsAt + 1 + k))}

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
            duration={timeline.duration}
            setScrollOffset={timeline.setScrollOffset}
            grid={doc.beatGrid}
          />
        </div>
      </div>
      </div>
    </div>
  )
}
