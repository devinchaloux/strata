/**
 * Vocabulary packs: a `.vocab.json` file of terms that someone can share and
 * another analyst can import into a file.
 *
 * Importing copies the terms into the document's own vocabulary, each tagged
 * with `source` ("Name v1.0.0"), so the `.strata` file stays self-contained:
 * it opens without the pack. Exporting writes the file's own types (not its
 * letters, which are made on demand, and not terms that came from another
 * pack) so they can be reused in other analyses. The format is in
 * schema/strata-vocab.schema.json; docs/decisions.md, "Vocabulary Packs",
 * has the reasons.
 */
import type { StrataDocument, VocabTerm, Vocabulary } from '@/types/strata'
import { builtInTerm, isLetterId } from '@/lib/vocabulary'

export interface VocabPack {
  /** Marks the file as a Strata pack; the format's version. */
  strataVocabPack: 1
  name: string
  version: string
  author?: string
  description?: string
  terms: VocabTerm[]
}

const ID = /^[a-z0-9][a-z0-9-]*$/
const KINDS = ['span', 'point-marker', 'mode'] as const
const LIST: Record<(typeof KINDS)[number], keyof Vocabulary> = {
  span: 'spanTypes',
  'point-marker': 'pointMarkerTypes',
  mode: 'modes',
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/**
 * Read a pack file. Throws, with a message for the analyst, when the file
 * isn't a pack at all; a pack with some unusable terms reads the rest and
 * names what it skipped.
 */
export function readVocabPack(raw: string): { pack: VocabPack; skipped: string[] } {
  let input: unknown
  try {
    input = JSON.parse(raw)
  } catch {
    throw new Error('This file isn’t valid JSON, so it can’t be a vocabulary pack.')
  }
  if (!isObj(input) || !Array.isArray(input.terms))
    throw new Error('This file isn’t a vocabulary pack: it has no list of terms.')
  const name = str(input.name)
  if (!name) throw new Error('This pack has no name.')
  const version = str(input.version) ?? '1.0.0'

  const skipped: string[] = []
  const terms: VocabTerm[] = []
  const seen = new Set<string>()
  for (const t of input.terms) {
    const id = isObj(t) ? str(t.id) : undefined
    const label = isObj(t) ? str(t.label) : undefined
    const kind = isObj(t) ? t.kind : undefined
    if (!isObj(t) || !id || !ID.test(id) || !label || !KINDS.includes(kind as (typeof KINDS)[number])) {
      skipped.push(`${id ?? 'A term'}: needs an id (lowercase letters, numbers, hyphens), a label and a kind`)
      continue
    }
    const key = `${kind}:${id}`
    if (seen.has(key)) {
      skipped.push(`${id}: listed twice`)
      continue
    }
    seen.add(key)
    const term: VocabTerm = { id, label, kind: kind as VocabTerm['kind'] }
    const description = str(t.description)
    if (description) term.description = description
    if (Array.isArray(t.broader)) {
      const broader = t.broader.filter((b): b is string => typeof b === 'string' && ID.test(b))
      if (broader.length) term.broader = broader
    }
    terms.push(term)
  }
  const pack: VocabPack = { strataVocabPack: 1, name, version, terms }
  const author = str(input.author)
  const description = str(input.description)
  if (author) pack.author = author
  if (description) pack.description = description
  return { pack, skipped }
}

export const packSource = (pack: Pick<VocabPack, 'name' | 'version'>) => `${pack.name} v${pack.version}`

export interface MergeResult {
  vocabulary: Vocabulary
  added: number
  updated: number
  /** Ids left out, with why. */
  skipped: string[]
}

/**
 * The document's vocabulary with a pack's terms merged in. A term the app
 * already ships, or one the file defines itself, keeps its meaning and the
 * pack's version is skipped; re-importing the same pack (any version)
 * replaces its earlier terms.
 */
export function mergeVocabPack(vocab: Vocabulary, pack: VocabPack): MergeResult {
  const source = packSource(pack)
  const samePack = (t: VocabTerm) => t.source === source || t.source?.startsWith(`${pack.name} v`)
  const next: Vocabulary = {
    spanTypes: [...vocab.spanTypes],
    pointMarkerTypes: [...vocab.pointMarkerTypes],
    modes: [...vocab.modes],
  }
  let added = 0
  let updated = 0
  const skipped: string[] = []
  for (const term of pack.terms) {
    const list = LIST[term.kind ?? 'span']
    const builtIn = builtInTerm(term.id)
    if (builtIn && builtIn.kind === term.kind) {
      skipped.push(`${term.id}: already built in`)
      continue
    }
    const i = next[list].findIndex((t) => t.id === term.id)
    if (i >= 0 && !samePack(next[list][i])) {
      skipped.push(`${term.id}: this file already has a type with that id`)
      continue
    }
    const tagged = { ...term, source }
    if (i >= 0) {
      next[list][i] = tagged
      updated++
    } else {
      next[list].push(tagged)
      added++
    }
  }
  return { vocabulary: next, added, updated, skipped }
}

/** A pack of the file's own types, for reuse in other analyses. */
export function exportVocabPack(doc: StrataDocument): VocabPack {
  const own = (list: VocabTerm[], kind: VocabTerm['kind']) =>
    list
      .filter((t) => !t.source && !isLetterId(t.id))
      .map(({ id, label, description, broader }) => ({
        id,
        label,
        ...(description ? { description } : {}),
        ...(broader?.length ? { broader } : {}),
        kind,
      }))
  return {
    strataVocabPack: 1,
    name: doc.title ? `${doc.title} types` : 'My types',
    version: '1.0.0',
    terms: [
      ...own(doc.vocabulary.spanTypes, 'span'),
      ...own(doc.vocabulary.pointMarkerTypes, 'point-marker'),
      ...own(doc.vocabulary.modes, 'mode'),
    ],
  }
}

/** How many of the file's own types an export would include. */
export function exportableCount(doc: StrataDocument): number {
  return exportVocabPack(doc).terms.length
}
