import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { Undo2, Redo2, Settings, CircleHelp } from 'lucide-react'
import { useFileIO } from '@/hooks/useFileIO'
import { useMerge } from '@/hooks/useMerge'
import { PlayerDock } from '@/components/PlayerDock'
import { FormDiagram } from '@/components/FormDiagram'
import { Inspector } from '@/components/Inspector'
import { MergeConflictDialog } from '@/components/MergeConflictDialog'
import { DocumentSettingsDialog } from '@/components/DocumentSettingsDialog'
import { LinkSourceDialog } from '@/components/LinkSourceDialog'
import { ExportDialog } from '@/components/ExportDialog'
import { HelpDialog } from '@/components/HelpDialog'
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
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'
import aliveRaw from '../schema/alive.strata?raw'
import { readStrataFile } from '@/lib/fileIO'
import { spanNeighbour, firstSpan, spanRange } from '@/lib/spanNav'
import { formSpans } from '@/lib/layers'
import { computePps, totalContentWidth, clampScrollOffset } from '@/lib/timeline'

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

// Heights of the toolbar and the play bar (h-10, h-12): the work area is one
// screen minus these.
const HEADER_H = 40
const TRANSPORT_H = 48

function ToolbarButton({
  onClick,
  disabled,
  title,
  muted,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  // Dev/secondary affordance (e.g. Demo) — rendered lighter so it reads as
  // non-primary chrome. (Demo itself is stripped before release.)
  muted?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        `rounded-md px-2.5 py-1 text-xs font-medium transition-colors
        hover:bg-accent hover:text-accent-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background
        disabled:opacity-40 disabled:pointer-events-none`,
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** Icon-only toolbar button — square, for compact chrome actions (undo, redo, settings). */
function IconToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors
        hover:bg-accent hover:text-accent-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background
        disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}

/** Layered wordmark glyph — three stacked strata, narrowing upward. */
function StrataMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <rect x="2" y="10.5" width="12" height="2" rx="1" fill="hsl(var(--primary))" />
      <rect x="3.5" y="7" width="9" height="2" rx="1" fill="var(--ink-muted)" />
      <rect x="5" y="3.5" width="6" height="2" rx="1" fill="var(--ink-faint)" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Empty state — the first screen before a document is loaded
// ---------------------------------------------------------------------------

function EmptyState({
  onNew,
  onOpen,
  onDemo,
  onHelp,
}: {
  onNew: () => void
  onOpen: () => void
  onDemo: () => void
  onHelp: () => void
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary">
          <StrataMark size={26} />
        </div>
        <h1 className="text-base font-semibold tracking-tight text-foreground">
          Start an analysis
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Create a new analysis or open a <code className="text-[0.8em]">.strata</code> file, then
          link a YouTube video or local audio file and build layered form diagrams on a
          shared timeline.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onNew}
            className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground
              transition-colors hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            New analysis
          </button>
          <button
            onClick={onOpen}
            className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium text-foreground
              transition-colors hover:bg-accent
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Open file…
          </button>
        </div>
        <button
          onClick={onDemo}
          className="mt-3 rounded text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline
            focus-visible:outline-none focus-visible:underline"
        >
          Or explore the demo analysis
        </button>
        <button
          onClick={onHelp}
          className="mt-1.5 rounded text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline
            focus-visible:outline-none focus-visible:underline"
        >
          How it works
        </button>
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Crash recovery modal
// ---------------------------------------------------------------------------

function RecoveryModal({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  const date = new Date(savedAt).toLocaleString()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm mx-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-foreground mb-1">Unsaved session found</h2>
        <p className="text-xs text-muted-foreground mb-5">
          An unsaved session from {date} was recovered. Would you like to restore it?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onDiscard}
            className="rounded px-3 py-1.5 text-xs font-medium text-muted-foreground
              hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onRestore}
            className="rounded px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground
              hover:bg-primary/90 transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Keyboard navigation between spans (lib/spanNav): arrows move the selection,
// Shift+←/→ extends it, Enter goes to the selected span's Label field.
// ---------------------------------------------------------------------------

/** Handles the key if it's a span-navigation key in the right context; returns whether it did. */
function navigateSpans(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  const tag = el?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return false
  // Menus and dialogs use the arrows themselves.
  if (el?.closest('[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"]')) return false
  if (e.metaKey || e.ctrlKey || e.altKey) return false
  const doc = useDocumentStore.getState().document
  if (!doc) return false
  const ui = useUIStore.getState()
  const selected = ui.selectedSpanIds

  if (e.key === 'Enter') {
    if (selected.length !== 1) return false
    const label = document.querySelector<HTMLInputElement>('[data-inspector-label]')
    if (!label) return false
    e.preventDefault()
    label.focus()
    label.select()
    return true
  }

  const dir = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as const)[
    e.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
  ]
  if (!dir) return false
  e.preventDefault()

  if (selected.length === 0) {
    const first = firstSpan(doc, ui.activeLayerId)
    if (first) selectAndReveal(first)
    return true
  }
  // Moving from the end of the selection that last moved (the anchor's
  // opposite end), so Shift+→ keeps growing to the right.
  const from = navFocus && selected.includes(navFocus) ? navFocus : selected[selected.length - 1]
  const to = spanNeighbour(doc, from, dir)
  if (!to) return true
  if (e.shiftKey && (dir === 'left' || dir === 'right') && ui.selectionAnchorId) {
    const range = spanRange(doc, ui.selectionAnchorId, to)
    if (range) {
      ui.setSelection(range, ui.selectionAnchorId)
      navFocus = to
      reveal(to)
      return true
    }
  }
  selectAndReveal(to)
  return true
}

/** The span keyboard navigation last moved to, so extending continues from it. */
let navFocus: string | null = null

function selectAndReveal(id: string) {
  useUIStore.getState().selectSpan(id)
  navFocus = id
  reveal(id)
}

/** Scrolls the timeline so the span is on screen, when zoomed in. */
function reveal(id: string) {
  const doc = useDocumentStore.getState().document
  const span = doc?.layers.flatMap(formSpans).find((s) => s.id === id)
  const ui = useUIStore.getState()
  if (!doc || !span || ui.viewportWidth <= 0) return
  const pps = computePps(ui.zoom)
  const left = span.startTime * pps - ui.scrollOffset
  const right = span.endTime * pps - ui.scrollOffset
  if (left >= 0 && right <= ui.viewportWidth) return
  const total = totalContentWidth(doc.duration, ui.zoom)
  ui.setScrollOffset(clampScrollOffset(span.startTime * pps - ui.viewportWidth * 0.2, total, ui.viewportWidth))
}

export default function App() {
  const {
    doc,
    isDirty,
    hasHandle,
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    pendingRecovery,
    restoreRecovery,
    dismissRecovery,
  } = useFileIO()

  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const appMessage = useUIStore((s) => s.appMessage)
  const dismissAppMessage = useUIStore((s) => s.dismissAppMessage)
  const setExportOpen = useUIStore((s) => s.setExportOpen)
  const setActiveLayer = useUIStore((s) => s.setActiveLayer)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const selectedSpanCount = useUIStore((s) => s.selectedSpanIds.length)
  const selectedMarkerId = useUIStore((s) => s.selectedPointMarkerId)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)
  const selectedCount = selectedSpanCount + (selectedMarkerId ? 1 : 0)

  // Inspector collapse is pure view-state; local to the shell.
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true)
  // Held in uiStore rather than local state; App is its only user today.
  const settingsOpen = useUIStore((s) => s.documentSettingsOpen)
  const setSettingsOpen = useUIStore((s) => s.setDocumentSettingsOpen)
  // "New analysis" framing for the settings dialog — set when the dialog was
  // opened by the New action, cleared when opened as plain settings.
  const [settingsIsNew, setSettingsIsNew] = useState(false)

  const [helpOpen, setHelpOpen] = useState(false)

  // Unsaved-changes guard: New / Open / Demo all discard the current document.
  // When dirty, the action is held here and only run if the analyst confirms.
  const [pendingDiscard, setPendingDiscard] = useState<{
    label: string
    run: () => void
  } | null>(null)

  // Auto-expand the Inspector whenever a selection is made, so clicking a span
  // always surfaces its details — matches the editor's pre-existing behavior.
  useEffect(() => {
    if (selectedCount > 0) setInspectorCollapsed(false)
  }, [selectedCount])

  // Undo/redo availability, read reactively off zundo's temporal store.
  const canUndo = useStore(useDocumentStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useDocumentStore.temporal, (s) => s.futureStates.length > 0)

  // Merge: eligibility drives the Ctrl+J keyboard shortcut; performMerge is held
  // in a ref so the keydown effect can call the latest closure without re-subscribing.
  const { performMerge } = useMerge()
  const performMergeRef = useRef(performMerge)
  performMergeRef.current = performMerge

  // New analysis = create the blank document AND open the setup modal (the
  // settings dialog in "new" framing) so naming the track and linking a video
  // or audio source happen in one step — a first-time user is never dropped
  // into a dead editor with no visible path to a playable source.
  const newAnalysis = useCallback(() => {
    newFile()
    setSettingsIsNew(true)
    setSettingsOpen(true)
  }, [newFile, setSettingsOpen])

  // Dev affordance — load the bundled "Alive" fixture to exercise the render path.
  const loadDemo = useCallback(() => {
    // Through the same reader as Open, so the demo can never drift from what
    // a real file is held to.
    const parsed = readStrataFile(aliveRaw).doc
    loadDocument(parsed)
    useDocumentStore.temporal.getState().clear()
  }, [loadDocument])

  // B places boundaries in the active layer, so there must always be one
  // when the document has a form layer: after New, Open, Demo, or deleting the
  // active layer, the top form layer takes over.
  const layers = useDocumentStore((s) => s.document?.layers)
  const activeLayerId = useUIStore((s) => s.activeLayerId)
  useEffect(() => {
    const forms = (layers ?? []).filter((l) => l.type === 'form-diagram')
    if (forms.some((l) => l.id === activeLayerId)) return
    const top = [...forms].sort((a, b) => b.displayOrder - a.displayOrder)[0]
    setActiveLayer(top?.id ?? null)
  }, [layers, activeLayerId, setActiveLayer])

  // Unsaved-changes guard: New / Open / Demo all discard whatever is currently
  // loaded. When the document is dirty, hold the action and confirm first —
  // crash recovery softens the cost of an accidental discard but doesn't
  // prevent one. Clean documents (including the empty-state case, where
  // isDirty is always false) run immediately, no dialog.
  const guardDiscard = useCallback(
    (label: string, run: () => void) => () => {
      if (isDirty) setPendingDiscard({ label, run })
      else run()
    },
    [isDirty],
  )
  const guardedNew = guardDiscard('Starting a new analysis', newAnalysis)
  const guardedOpen = guardDiscard('Opening a different file', () => void openFile())
  const guardedDemo = guardDiscard('Loading the demo analysis', loadDemo)

  // Clicking away deselects. A pointerdown outside the diagram and the
  // Inspector (both marked data-keeps-selection) clears the selection — but
  // not one on a control (using the transport while a span is selected isn't
  // "clicking away") or inside a dialog, popover or menu, which Radix renders
  // outside both. Clicking the Inspector must never deselect, or the selected
  // span couldn't be edited.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = e.target as Element | null
      if (!el?.closest) return
      if (
        el.closest(
          '[data-keeps-selection], button, input, select, textarea, a, [role="dialog"], [role="alertdialog"], [role="menu"], [data-radix-popper-content-wrapper]',
        )
      ) {
        return
      }
      clearSelection()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [clearSelection])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Escape — deselect all spans (skip when focus is inside a text field so
      // Escape can still cancel an edit without collapsing the panel).
      if (e.key === 'Escape') {
        const el = e.target as HTMLElement | null
        const tag = el?.tagName
        const inField =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
        if (!inField) {
          clearSelection()
          selectPointMarker(null)
          return
        }
      }

      // ? — the help dialog, from anywhere but a text field.
      if (e.key === '?') {
        const el = e.target as HTMLElement | null
        const tag = el?.tagName
        const inField =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
        if (!inField) {
          e.preventDefault()
          setHelpOpen(true)
          return
        }
      }

      if (navigateSpans(e)) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Undo / redo. Inside a text field, let the browser handle native text
      // undo instead of walking the document history.
      if (e.key === 'z' || e.key === 'Z') {
        const el = e.target as HTMLElement | null
        const tag = el?.tagName
        const inField =
          tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
        if (inField) return
        e.preventDefault()
        const temporal = useDocumentStore.temporal.getState()
        if (e.shiftKey) temporal.redo()
        else temporal.undo()
        return
      }

      // Ctrl/Cmd+J — Join (merge) the selected spans. No-ops when ineligible.
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        performMergeRef.current()
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        guardedNew()
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        guardedOpen()
      } else if ((e.key === 's' || e.key === 'S') && e.shiftKey) {
        e.preventDefault()
        saveFileAs()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearSelection, selectPointMarker, guardedNew, guardedOpen, saveFile, saveFileAs])

  return (
    // App shell: a pinned header, then a main row of [left work area | right
    // inspector]. The page itself scrolls, only far enough to bring a docked
    // video into view; the header and inspector stay put.
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Toolbar — pinned while the page scrolls down to the video. */}
      <header className="sticky top-0 z-40 flex h-10 shrink-0 items-center gap-1 border-b border-border bg-background px-3">
        <span className="mr-1 flex items-center gap-1.5 select-none">
          <StrataMark />
          <span className="text-sm font-semibold tracking-tight text-foreground">Strata</span>
          <span
            className="rounded border border-border px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            title="Strata is in beta. Save often, and keep a copy of files that matter."
          >
            Beta
          </span>
        </span>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <ToolbarButton onClick={guardedNew}>New</ToolbarButton>
        <ToolbarButton onClick={guardedOpen}>Open</ToolbarButton>
        <ToolbarButton onClick={guardedDemo} muted title="Load the bundled demo analysis">
          Demo
        </ToolbarButton>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <ToolbarButton onClick={saveFile} disabled={!doc}>
          {hasHandle ? 'Save' : 'Download'}
        </ToolbarButton>
        <ToolbarButton onClick={saveFileAs} disabled={!doc}>
          Save As
        </ToolbarButton>
        <ToolbarButton onClick={() => setExportOpen(true)} disabled={!doc} title="Save the form diagram as an SVG or PNG figure">
          Export
        </ToolbarButton>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <IconToolbarButton
          onClick={() => useDocumentStore.temporal.getState().undo()}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </IconToolbarButton>
        <IconToolbarButton
          onClick={() => useDocumentStore.temporal.getState().redo()}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} />
        </IconToolbarButton>

        <IconToolbarButton
          onClick={() => {
            setSettingsIsNew(false)
            setSettingsOpen(true)
          }}
          disabled={!doc}
          title="Document settings"
        >
          <Settings size={14} />
        </IconToolbarButton>
        <IconToolbarButton onClick={() => setHelpOpen(true)} title="How Strata works (?)">
          <CircleHelp size={14} />
        </IconToolbarButton>

        {isDirty && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
            title="You have unsaved changes"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: 'var(--ink-faint)' }}
              aria-hidden
            />
            Unsaved changes
          </span>
        )}
      </header>

      {/* Main row. The work area (diagram, then the play bar) fills exactly one
          screen; a docked video sits below it, off-screen until the page is
          scrolled. YouTube forbids hiding or covering its player, not scrolling
          it out of view (docs/decisions.md, "Video Below the Fold"). */}
      <div className="flex">
        {/* relative: the mini video player anchors to this column's corner */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-col" style={{ height: `calc(100vh - ${HEADER_H + TRANSPORT_H}px)` }}>
            {doc ? (
              <FormDiagram />
            ) : (
              <EmptyState onNew={guardedNew} onOpen={guardedOpen} onDemo={guardedDemo} onHelp={() => setHelpOpen(true)} />
            )}
          </div>
          {/* The play bar, then the docked video below the fold */}
          <PlayerDock />
        </div>

        {doc && (
          // Pinned beside the work area while the page scrolls.
          <div className="sticky flex self-start" style={{ top: HEADER_H, height: `calc(100vh - ${HEADER_H}px)` }}>
            <Inspector
              collapsed={inspectorCollapsed}
              onToggle={() => setInspectorCollapsed((v) => !v)}
            />
          </div>
        )}
      </div>

      {/* Merge conflict dialog — renders only when a merge has conflicts */}
      <MergeConflictDialog />

      {/* Document settings — top-level StrataDocument metadata. Doubles as the
          new-analysis setup modal when opened by the New action. */}
      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isNew={settingsIsNew}
      />

      {/* Link source — set/swap/unlink the playback source (transport + settings open it) */}
      <LinkSourceDialog />

      {/* Export — the form diagram as an SVG or PNG figure */}
      <ExportDialog />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      {/* Crash recovery modal */}
      {pendingRecovery && (
        <RecoveryModal
          savedAt={pendingRecovery.savedAt}
          onRestore={restoreRecovery}
          onDiscard={dismissRecovery}
        />
      )}

      {/* Messages the analyst must read: a file that couldn't open or save,
          or one that opened with warnings. */}
      <AlertDialog open={appMessage !== null} onOpenChange={(o) => !o && dismissAppMessage()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{appMessage?.title}</AlertDialogTitle>
            {appMessage?.lines.map((line, i) => (
              <AlertDialogDescription key={i}>{line}</AlertDialogDescription>
            ))}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissAppMessage}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved-changes guard — confirms before New / Open / Demo discard the
          current document. Crash recovery (above) is a safety net, not a
          substitute for asking first. */}
      <AlertDialog
        open={pendingDiscard !== null}
        onOpenChange={(o) => !o && setPendingDiscard(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDiscard?.label} will discard your unsaved changes. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingDiscard?.run()
                setPendingDiscard(null)
              }}
              className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }))}
            >
              Discard and continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
