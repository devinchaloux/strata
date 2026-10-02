/**
 * Give spans a type, as one undo step: add the term to the file first when it
 * is new (a letter, say), then set the type, and let each span's label follow
 * the type where it still can (lib/vocabulary.ts, labelFollowsType).
 */
import type { VocabTerm } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import { labelFollowsType, type PickerTerm } from '@/lib/vocabulary'
import { useDocumentStore } from './documentStore'
import { newGestureKey, withHistoryGroup } from './history'

export function applySpanType(spanIds: string[], term: PickerTerm | null, add?: VocabTerm) {
  const store = useDocumentStore.getState()
  const doc = store.document
  if (!doc || !spanIds.length) return
  withHistoryGroup(newGestureKey('type-pick'), () => {
    if (add) store.addVocabTerm('spanTypes', add)
    const custom = useDocumentStore.getState().document?.vocabulary.spanTypes ?? []
    const spans = doc.layers.flatMap(formSpans).filter((s) => spanIds.includes(s.id))
    const following = spans.filter((s) => labelFollowsType(s.label, s.type, custom)).map((s) => s.id)
    store.updateSpans(spanIds, { type: term?.id ?? null })
    if (term && following.length) store.setSpanLabels(following, term.label)
  })
}
