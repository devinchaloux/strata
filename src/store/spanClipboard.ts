/**
 * Copy and paste between spans: Ctrl/⌘+C copies the selected spans, and
 * Ctrl/⌘+V pastes the chosen parts of them (by default the label and type),
 * one undo step. One copied span pastes onto every selected span; several
 * paste in time order onto the same number of selected spans, first to first. Which parts paste is the analyst's
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
  /** In time order; empty when nothing has been copied. */
  copied: CopiedSpan[]
  fields: PasteField[]
  setFields: (fields: PasteField[]) => void
}

export const useSpanClipboard = create<ClipboardState>()((set) => ({
  copied: [],
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

/**
 * Spans by id, in time order (at the same time, the higher layer first): the
 * order copied spans and paste targets are paired in.
 */
function inOrder(ids: string[]): Span[] {
  const doc = useDocumentStore.getState().document
  if (!doc) return []
  return doc.layers
    .filter((l) => l.type === 'form-diagram')
    .flatMap((l) => formSpans(l).filter((s) => ids.includes(s.id)).map((span) => ({ span, order: l.displayOrder })))
    .sort((a, b) => a.span.startTime - b.span.startTime || b.order - a.order)
    .map((e) => e.span)
}

/** Copy spans (and their commentary), in time order. False if none is in the document. */
export function copySpans(spanIds: string[]): boolean {
  const doc = useDocumentStore.getState().document
  const spans = inOrder(spanIds)
  if (!doc || !spans.length) return false
  useSpanClipboard.setState({ copied: spans.map((span) => ({ span, commentary: blockForSpan(doc, span.id)?.text ?? '' })) })
  return true
}

/**
 * Whether what's copied can paste onto `spanIds`: one copied span onto any
 * selection (but itself), several onto the same number. The reason when not.
 */
export function pasteCheck(spanIds: string[]): { ok: boolean; reason: string | null } {
  const { copied } = useSpanClipboard.getState()
  if (!copied.length) return { ok: false, reason: 'Copy a span first (Ctrl/⌘+C).' }
  if (copied.length === 1) {
    const ok = spanIds.some((id) => id !== copied[0].span.id)
    return { ok, reason: ok ? null : 'Select the spans to paste onto.' }
  }
  if (spanIds.length !== copied.length)
    return { ok: false, reason: `${copied.length} spans copied: select ${copied.length} to paste them in order.` }
  return { ok: true, reason: null }
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
 * Paste the chosen parts of what's copied onto `spanIds`, one undo step: one
 * copied span onto each of them (not onto itself), or several onto as many,
 * paired in time order. Returns how many spans changed (0 when it can't).
 */
export function pasteOnto(spanIds: string[], fields = useSpanClipboard.getState().fields): number {
  const { copied } = useSpanClipboard.getState()
  if (!fields.length || !pasteCheck(spanIds).ok) return 0
  const pairs: [CopiedSpan, string][] =
    copied.length === 1
      ? spanIds.filter((id) => id !== copied[0].span.id).map((id) => [copied[0], id])
      : inOrder(spanIds).map((target, i) => [copied[i], target.id])
  withHistoryGroup(newGestureKey('paste'), () => {
    for (const [from, id] of pairs) {
      if (from.span.id === id) continue
      const store = useDocumentStore.getState()
      const patch = pastePatch(from.span, fields)
      if (Object.keys(patch).length) store.updateSpans([id], patch)
      if (fields.includes('label')) useDocumentStore.getState().setSpanLabels([id], from.span.label ?? null)
      if (fields.includes('commentary')) useDocumentStore.getState().setSpanCommentary(id, from.commentary)
    }
  })
  return pairs.filter(([from, id]) => from.span.id !== id).length
}
