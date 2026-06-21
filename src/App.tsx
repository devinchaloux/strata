import { useEffect } from 'react'
import { useFileIO } from '@/hooks/useFileIO'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { FormDiagram } from '@/components/FormDiagram'
import { MetadataPanel } from '@/components/MetadataPanel'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import aliveRaw from '../schema/alive.strata?raw'
import type { StrataDocument } from '@/types/strata'

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded px-2.5 py-1 text-xs font-medium text-foreground
        hover:bg-accent hover:text-accent-foreground
        disabled:opacity-40 disabled:pointer-events-none
        transition-colors"
    >
      {children}
    </button>
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
        <span className="mr-3 text-sm font-semibold tracking-tight">Strata</span>

        <ToolbarButton onClick={newFile}>New</ToolbarButton>
        <ToolbarButton onClick={openFile}>Open</ToolbarButton>
        <ToolbarButton onClick={loadDemo}>Demo</ToolbarButton>

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton onClick={saveFile} disabled={!doc}>
          {hasHandle ? 'Save' : 'Download'}
        </ToolbarButton>
        <ToolbarButton onClick={saveFileAs} disabled={!doc}>
          Save As
        </ToolbarButton>

        {isDirty && (
          <span className="ml-auto text-xs text-muted-foreground">Unsaved changes</span>
        )}
      </header>

      {/* Work area row — form diagram + right metadata panel (panel renders
          null when nothing is selected) */}
      <div className="flex min-h-0 flex-1">
        {doc ? (
          <FormDiagram />
        ) : (
          <main className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Open a .strata file or create a new analysis to begin.
            </p>
          </main>
        )}
        <MetadataPanel />
      </div>

      {/* Transport bar + collapsible video panel — bottom of the shell */}
      <YouTubePlayer />

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
