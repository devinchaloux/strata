/**
 * Copy and paste between spans: Ctrl/⌘+C copies the selected span, and
 * Ctrl/⌘+V pastes the chosen parts of it onto every selected span (by default
 * the label and type), one undo step. Which parts paste is the analyst's
 * remembered choice, set in the Inspector's Paste menu. The clipboard is the
 * app's own, not the system's, and lasts the visit. docs/decisions.md, "Copy
 * and Paste Between Spans".
 */
import { create } from 'zustand'
import { useDocumentStore } from '@/store/documentStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { blockForSpan } from '@/widgets/written-analysis/commentary'
import { formSpans } from '@/lib/layers'
import type { Span } from '@/types/strata'

export type PasteField = 'label' | 'type' | 'annotation' | 'commentary' | 'lyrics' | 'fill' | 'pattern' | 'shape'

export const PASTE_FIELDS: { id: PasteField; name: string }[] = [
  { id: 'label', name: 'Label' },
  { id: 'type', name: 'Type' },
  { id: 'annotation', name: 'Annotation' },
  { id: 'commentary', name: 'Commentary' },
  { id: 'lyrics', name: 'Lyrics' },
  { id: 'fill', name: 'Fill colour' },
  { id: 'pattern', name: 'Pattern' },
  { id: 'shape', name: 'Shape and line' },
]

const FIELDS_KEY = 'strata:pasteFields'
const DEFAULT_FIELDS: PasteField[] = ['label', 'type']

function readFields(): PasteField[] {
  try {
    const raw = localStorage.getItem(FIELDS_KEY)
    if (raw == null) return DEFAULT_FIELDS
    return raw.split(',').filter((f): f is PasteField => PASTE_FIELDS.some((p) => p.id === f))
  } catch {
    return DEFAULT_FIELDS
  }
}

/** What was copied: the span, and its commentary text. */
export interface CopiedSpan {
  span: Span
  commentary: string
}

interface ClipboardState {
  copied: CopiedSpan | null
  fields: PasteField[]
  setFields: (fields: PasteField[]) => void
}

export const useSpanClipboard = create<ClipboardState>()((set) => ({
  copied: null,
  fields: readFields(),
  setFields: (fields) => {
    try {
      localStorage.setItem(FIELDS_KEY, fields.join(','))
    } catch {
      // Remembered for this visit only.
    }
    set({ fields })
  },
}))

/** Copy a span (and its commentary). False if it isn't in the document. */
export function copySpan(spanId: string): boolean {
  const doc = useDocumentStore.getState().document
  const span = doc?.layers.flatMap(formSpans).find((s) => s.id === spanId)
  if (!doc || !span) return false
  useSpanClipboard.setState({ copied: { span, commentary: blockForSpan(doc, spanId)?.text ?? '' } })
  return true
}

/** The span fields each paste choice carries (label and commentary are written their own way). */
export function pastePatch(from: Span, fields: PasteField[]): Partial<Omit<Span, 'id'>> {
  const patch: Partial<Omit<Span, 'id'>> = {}
  if (fields.includes('type')) patch.type = from.type ?? null
  if (fields.includes('annotation')) patch.annotation = from.annotation ?? null
  if (fields.includes('lyrics')) patch.lyrics = from.lyrics ?? null
  if (fields.includes('fill')) patch.fillColor = from.fillColor ?? null
  if (fields.includes('pattern')) patch.fillPattern = from.fillPattern
  if (fields.includes('shape')) {
    patch.startCap = from.startCap
    patch.endCap = from.endCap
    patch.startBoundaryType = from.startBoundaryType
    patch.endBoundaryType = from.endBoundaryType
    patch.lineStyle = from.lineStyle
  }
  return patch
}

/**
 * Paste the chosen parts of the copied span onto `spanIds` (the copied span
 * itself is skipped), one undo step. Returns how many spans changed.
 */
export function pasteOnto(spanIds: string[], fields = useSpanClipboard.getState().fields): number {
  const { copied } = useSpanClipboard.getState()
  const targets = spanIds.filter((id) => id !== copied?.span.id)
  if (!copied || !targets.length || !fields.length) return 0
  const store = useDocumentStore.getState()
  withHistoryGroup(newGestureKey('paste'), () => {
    const patch = pastePatch(copied.span, fields)
    if (Object.keys(patch).length) store.updateSpans(targets, patch)
    if (fields.includes('label')) useDocumentStore.getState().setSpanLabels(targets, copied.span.label ?? null)
    if (fields.includes('commentary'))
      for (const id of targets) useDocumentStore.getState().setSpanCommentary(id, copied.commentary)
  })
  return targets.length
}
