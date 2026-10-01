/**
 * ErrorBoundary — the last line of defence when a render throws.
 *
 * Without it, any rendering error blanks the whole page and leaves no way back
 * except a reload that loses everything since the last autosave. Here, the
 * moment something throws, the current document is written to crash recovery
 * (so nothing is lost, not even the last 30 seconds), and the analyst sees
 * what happened and how to get their work back.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { saveRecovery } from '@/lib/crashRecovery'

interface State {
  error: Error | null
  saved: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, saved: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const doc = useDocumentStore.getState().document
    if (doc) saveRecovery(doc)
    this.setState({ saved: doc !== null })
    console.error('Strata render error:', error, info.componentStack)
  }

  render() {
    const { error, saved } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-2 text-sm font-semibold text-foreground">Strata stopped with an error</h1>
          <p className="mb-3 text-xs text-muted-foreground">
            {saved
              ? 'Your analysis was saved for recovery the moment this happened. Reload the page and choose Restore to pick up where you left off.'
              : 'Reload the page to start again.'}
          </p>
          <pre className="mb-4 max-h-32 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
            {error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
