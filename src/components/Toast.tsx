/**
 * Toast — a short message at the foot of the screen after an action from a
 * menu changes the document, with Undo (docs/decisions.md, "Menus Are Names").
 * It names what changed ("Counted 198 bars") and hides itself after a few
 * seconds; the change on the diagram is the rest of the confirmation.
 */
import { useEffect } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'

/** How long a toast stays, in ms. */
export const TOAST_MS = 5000

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  const clearToast = useUIStore((s) => s.clearToast)
  const n = toast?.n
  useEffect(() => {
    if (n === undefined) return
    const t = window.setTimeout(clearToast, TOAST_MS)
    return () => window.clearTimeout(t)
  }, [n, clearToast])
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg px-3 py-2 text-[13px] shadow-lg"
      style={{ background: 'var(--ink-primary)', color: 'var(--canvas)' }}
    >
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          className="rounded px-1.5 font-semibold hover:bg-white/15"
          onClick={() => {
            useDocumentStore.temporal.getState().undo()
            clearToast()
          }}
        >
          Undo
        </button>
      )}
    </div>
  )
}
