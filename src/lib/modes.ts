/**
 * Built-in modes for StrataDocument.homeKey — ships in code, not in the
 * document. Project-level custom modes (e.g. Renaissance 8-mode/12-mode
 * systems) go in vocabulary.modes, using the same VocabTerm mechanism already
 * established for span types and point marker types.
 */

import type { VocabTerm } from '@/types/strata'

export const BUILT_IN_MODES: VocabTerm[] = [
  { id: 'major', label: 'Major' },
  { id: 'minor', label: 'Minor' },
  { id: 'dorian', label: 'Dorian' },
  { id: 'phrygian', label: 'Phrygian' },
  { id: 'lydian', label: 'Lydian' },
  { id: 'mixolydian', label: 'Mixolydian' },
  { id: 'locrian', label: 'Locrian' },
  {
    id: 'ionian',
    label: 'Ionian',
    description: 'Same pitch collection as Major — kept separate for modal-theory terminology.',
  },
  {
    id: 'aeolian',
    label: 'Aeolian',
    description: 'Same pitch collection as (natural) Minor — kept separate for modal-theory terminology.',
  },
]

/** Resolve a mode id against the built-in list plus a document's custom modes. */
export function findMode(id: string | null | undefined, customModes: VocabTerm[]): VocabTerm | undefined {
  if (!id) return undefined
  return BUILT_IN_MODES.find((m) => m.id === id) ?? customModes.find((m) => m.id === id)
}
