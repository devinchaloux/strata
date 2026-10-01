/**
 * Built-in point marker types, as VocabTerms. The list itself lives in
 * lib/vocabulary.ts with the span types, grouped into libraries; this module
 * keeps the marker-specific helpers (lookup, caption).
 *
 * `label` is the form written on a diagram: theorists write "PAC", not
 * "Perfect authentic cadence". `description` carries the full name, which the
 * picker shows so the abbreviation never has to be guessed.
 */

import type { PointMarker, VocabTerm } from '@/types/strata'
import { BUILT_IN_POINT_MARKER_TERMS } from '@/lib/vocabulary'

export const BUILT_IN_POINT_MARKER_TYPES: VocabTerm[] = BUILT_IN_POINT_MARKER_TERMS.map((t) => ({
  id: t.id,
  label: t.label,
  ...(t.name ? { description: t.name } : {}),
  kind: 'point-marker',
}))

/** Resolve a type id against the built-in list plus a document's custom types. */
export function findPointMarkerType(
  id: string | null | undefined,
  customTypes: VocabTerm[],
): VocabTerm | undefined {
  if (!id) return undefined
  return (
    BUILT_IN_POINT_MARKER_TYPES.find((t) => t.id === id) ?? customTypes.find((t) => t.id === id)
  )
}

/** Text the picker shows: "Perfect authentic cadence (PAC)" when both exist. */
export function pickerLabel(term: VocabTerm): string {
  return term.description ? `${term.description} (${term.label})` : term.label
}

/**
 * The caption written on the diagram.
 *
 * Theorists write a cadence together with the key it lands in, as "V:PAC" —
 * one glyph, read as "a PAC in the dominant". The two halves are stored
 * separately (`type` is vocabulary, `harmonicContext` is the key) so both stay
 * corpus-queryable; this function is the only place they are joined, and it
 * joins them only when both are present. A type with no key renders alone, a
 * key with no type renders alone, and neither renders nothing. That
 * conditionality is what the 2026-07-04 redesign was actually after when it
 * removed the unconditional `{context}:{type}` string.
 */
export function formatMarkerCaption(
  marker: Pick<PointMarker, 'type' | 'harmonicContext'>,
  customTypes: VocabTerm[],
): string | null {
  const term = findPointMarkerType(marker.type, customTypes)
  const typeLabel = term?.label ?? marker.type ?? null
  const key = marker.harmonicContext?.trim() || null
  if (key && typeLabel) return `${key}:${typeLabel}`
  return typeLabel ?? key
}
