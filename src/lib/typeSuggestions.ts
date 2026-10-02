/**
 * What to offer when typing a span or marker: the types its level already
 * uses, then the rest of the file, both in order of first appearance, then the
 * unused types of the library the level seems to draw on. Shared by the Type
 * picker and the quick-type bar on the diagram.
 */
import type { StrataDocument } from '@/types/strata'
import { formSpans } from '@/lib/layers'
import {
  LIBRARIES,
  findTerm,
  isLetterId,
  letterTerm,
  likelyLibrary,
  typesInOrder,
  type Library,
  type PickerTerm,
  type TermKind,
} from '@/lib/vocabulary'

export interface TypeSuggestions {
  /** The layer works in letters (it uses them, or its library is 'letters'). */
  lettered: boolean
  inLayer: PickerTerm[]
  elsewhere: PickerTerm[]
  suggested: { lib: Library; terms: PickerTerm[] } | null
  /** The letter after the highest one the file uses (A in a new file); null after Z. */
  nextLetter: string | null
}

export function typeSuggestions(doc: StrataDocument, kind: TermKind, layerId?: string): TypeSuggestions {
  const custom = kind === 'span' ? doc.vocabulary.spanTypes : doc.vocabulary.pointMarkerTypes
  const resolve = (ids: string[]) => ids.map((id) => findTerm(id, kind, custom)).filter((t): t is PickerTerm => !!t)
  const layer = layerId ? doc.layers.find((l) => l.id === layerId) : undefined
  const layerIds = layer ? typesInOrder(formSpans(layer).map((s) => ({ type: s.type, time: s.startTime }))) : []
  const fileIds =
    kind === 'span'
      ? typesInOrder(doc.layers.flatMap(formSpans).map((s) => ({ type: s.type, time: s.startTime })))
      : typesInOrder(doc.pointMarkers.map((m) => ({ type: m.type, time: m.timestamp })))
  // The file's own terms not yet used come last; imported packs have their own group.
  const unusedOwn = custom.filter((t) => !t.source && !fileIds.includes(t.id) && !isLetterId(t.id)).map((t) => t.id)
  const ownLetters = custom.filter((t) => isLetterId(t.id) && !fileIds.includes(t.id)).map((t) => t.id)
  const elsewhereIds = [...fileIds.filter((id) => !layerIds.includes(id)), ...ownLetters, ...unusedOwn]
  // The layer's chosen library (Layer.library), else a guess from its types.
  const chosen = layer?.library ? LIBRARIES.find((l) => l.id === layer.library) : undefined
  const lib = chosen ?? likelyLibrary(layerIds.length ? layerIds : fileIds, kind)
  const key = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  const letters = [...fileIds, ...ownLetters].filter(isLetterId).map((id) => id.charCodeAt(0) - 97)
  const next = letters.length ? Math.max(...letters) + 1 : 0
  const inLayer = resolve(layerIds)
  return {
    lettered: layer?.library === 'letters' || inLayer.some((t) => isLetterId(t.id)),
    inLayer,
    elsewhere: resolve(elsewhereIds),
    suggested: lib ? { lib, terms: resolve(lib[key].filter((id) => !fileIds.includes(id))) } : null,
    nextLetter: next < 26 ? String.fromCharCode(65 + next) : null,
  }
}

/**
 * The few types worth a number key on the quick-type bar: on a lettered level,
 * its letters and the next one (up to nine, letters being short); otherwise
 * the layer's own types, then its library's (chosen, or guessed) in the
 * library's order, up to `max`. Other layers' types are left to the picker.
 */
export function quickTypes(doc: StrataDocument, layerId: string, max = 9): { term: PickerTerm; isNew?: boolean }[] {
  const s = typeSuggestions(doc, 'span', layerId)
  if (s.lettered) {
    const letters = s.inLayer.filter((t) => isLetterId(t.id)).sort((a, b) => a.label.localeCompare(b.label))
    // Letters get every number key, and the next letter always keeps one.
    const room = s.nextLetter ? 8 : 9
    const out: { term: PickerTerm; isNew?: boolean }[] = letters.slice(0, room).map((term) => ({ term }))
    if (s.nextLetter) out.push({ term: { ...letterTerm(s.nextLetter, 0), kind: 'span' }, isNew: true })
    return out
  }
  const seen = new Set<string>()
  const out: { term: PickerTerm }[] = []
  for (const term of [...s.inLayer, ...(s.suggested?.terms ?? [])]) {
    if (out.length >= max) break
    if (seen.has(term.id) || isLetterId(term.id)) continue
    seen.add(term.id)
    out.push({ term })
  }
  return out
}
