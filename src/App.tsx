import { useEffect, useRef } from 'react'
import { useFileIO } from '@/hooks/useFileIO'
import { useMerge } from '@/hooks/useMerge'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { FormDiagram } from '@/components/FormDiagram'
import { MetadataPanel } from '@/components/MetadataPanel'
import { MergeConflictDialog } from '@/components/MergeConflictDialog'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'
import aliveRaw from '../schema/alive.strata?raw'
import type { StrataDocument } from '@/types/strata'

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

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
}: {
  onNew: () => void
  onOpen: () => void
  onDemo: () => void
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
          link a YouTube video and build layered form diagrams on a shared timeline.
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
  const setActiveLayer = useUIStore((s) => s.setActiveLayer)

  // Merge: eligibility drives the toolbar button; performMerge is held in a ref
  // so the keydown effect can call the latest closure without re-subscribing.
  const { eligibility: mergeEligibility, performMerge } = useMerge()
  const performMergeRef = useRef(performMerge)
  performMergeRef.current = performMerge

  // Dev affordance — load the bundled "Alive" fixture to exercise the render path.
  function loadDemo() {
    const parsed = JSON.parse(aliveRaw) as StrataDocument
    loadDocument(parsed)
    useDocumentStore.temporal.getState().clear()
    // Make the macro layer (highest displayOrder) the active layer by default.
    const top = [...parsed.layers].sort((a, b) => b.displayOrder - a.displayOrder)[0]
    setActiveLayer(top?.id ?? null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
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
        newFile()
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        openFile()
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
  }, [newFile, openFile, saveFile, saveFileAs])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Toolbar */}
      <header className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <span className="mr-1 flex items-center gap-1.5 select-none">
          <StrataMark />
          <span className="text-sm font-semibold tracking-tight text-foreground">Strata</span>
        </span>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <ToolbarButton onClick={newFile}>New</ToolbarButton>
        <ToolbarButton onClick={openFile}>Open</ToolbarButton>
        <ToolbarButton onClick={loadDemo} muted title="Load the bundled demo analysis">
          Demo
        </ToolbarButton>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <ToolbarButton onClick={saveFile} disabled={!doc}>
          {hasHandle ? 'Save' : 'Download'}
        </ToolbarButton>
        <ToolbarButton onClick={saveFileAs} disabled={!doc}>
          Save As
        </ToolbarButton>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <ToolbarButton
          onClick={() => performMerge()}
          disabled={!mergeEligibility.ok}
          title={mergeEligibility.ok ? 'Merge selected spans (Ctrl+J)' : mergeEligibility.reason}
        >
          Merge
        </ToolbarButton>

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

      {/* Work area row — form diagram + right metadata panel (panel renders
          null when nothing is selected) */}
      <div className="flex min-h-0 flex-1">
        {doc ? (
          <FormDiagram />
        ) : (
          <EmptyState onNew={newFile} onOpen={openFile} onDemo={loadDemo} />
        )}
        <MetadataPanel />
      </div>

      {/* Transport bar + collapsible video panel — bottom of the shell */}
      <YouTubePlayer />

      {/* Merge conflict dialog — renders only when a merge has conflicts */}
      <MergeConflictDialog />

      {/* Crash recovery modal */}
      {pendingRecovery && (
        <RecoveryModal
          savedAt={pendingRecovery.savedAt}
          onRestore={restoreRecovery}
          onDiscard={dismissRecovery}
        />
      )}
    </div>
  )
}
