/**
 * Built-in point marker types — ships in code, not in the document, mirroring
 * lib/modes.ts. Project-level custom types still live in
 * vocabulary.pointMarkerTypes using the same VocabTerm mechanism.
 *
 * `label` is the form written on a diagram: theorists write "PAC", not
 * "Perfect authentic cadence". `description` carries the full name, which the
 * picker shows so the abbreviation never has to be guessed.
 *
 * The tradition-grouped picker with custom types and pack import is backlog #6.
 * This is the starter set that will feed it; the grouping here is local to the
 * built-in list rather than a VocabTerm field, so nothing in the schema has to
 * anticipate #6's final shape.
 */

import type { PointMarker, VocabTerm } from '@/types/strata'

export interface PointMarkerTypeGroup {
  label: string
  terms: VocabTerm[]
}

export const BUILT_IN_POINT_MARKER_TYPE_GROUPS: PointMarkerTypeGroup[] = [
  {
    label: 'Cadences',
    terms: [
      { id: 'perfect-authentic-cadence', label: 'PAC', description: 'Perfect authentic cadence', kind: 'point-marker' },
      { id: 'imperfect-authentic-cadence', label: 'IAC', description: 'Imperfect authentic cadence', kind: 'point-marker' },
      { id: 'half-cadence', label: 'HC', description: 'Half cadence', kind: 'point-marker' },
      { id: 'deceptive-cadence', label: 'DC', description: 'Deceptive cadence', kind: 'point-marker' },
      { id: 'evaded-cadence', label: 'EC', description: 'Evaded cadence', kind: 'point-marker' },
      { id: 'phrygian-half-cadence', label: 'PHC', description: 'Phrygian half cadence', kind: 'point-marker' },
      { id: 'plagal-cadence', label: 'PC', description: 'Plagal cadence', kind: 'point-marker' },
    ],
  },
  {
    label: 'Hepokoski / Darcy',
    terms: [
      { id: 'medial-caesura', label: 'MC', description: 'Medial caesura', kind: 'point-marker' },
      { id: 'essential-expositional-closure', label: 'EEC', description: 'Essential expositional closure', kind: 'point-marker' },
      { id: 'essential-structural-closure', label: 'ESC', description: 'Essential structural closure', kind: 'point-marker' },
    ],
  },
  {
    label: 'General',
    terms: [
      { id: 'downbeat', label: 'Downbeat', kind: 'point-marker' },
      { id: 'key-change', label: 'Key change', kind: 'point-marker' },
      { id: 'tempo-change', label: 'Tempo change', kind: 'point-marker' },
      { id: 'note', label: 'Note', kind: 'point-marker' },
    ],
  },
]

export const BUILT_IN_POINT_MARKER_TYPES: VocabTerm[] =
  BUILT_IN_POINT_MARKER_TYPE_GROUPS.flatMap((g) => g.terms)

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
