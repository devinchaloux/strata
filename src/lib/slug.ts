/**
 * Slugs — the stable, human-readable reference key for a span.
 *
 * An embed names a span by slug (`?embed&focus=drop-1`, lib/embed.ts), so a slug
 * has two jobs the label doesn't: it must be UNIQUE across the document (an
 * embed has no layer to disambiguate with) and STABLE once something could be
 * pointing at it.
 *
 * Stability rule (2026-09-27): a slug follows its label freely until the
 * document is saved with it. A saved file is the only thing an embed can
 * reference, so from then on the slug is frozen — renaming "Drop" to "Drop 1"
 * no longer breaks `focus="drop"`. The analyst can still regenerate it on
 * purpose from the metadata panel. The store tracks which spans are frozen;
 * the functions here are pure.
 */

import type { StrataDocument, Span, FormDiagramData } from '@/types/strata'

// A prime written after a single letter or digit (A′, A', A'' …) is part of
// the name, not punctuation, so it's spelled out — matching the vocabulary's
// own ids (`a-prime`, `a-double-prime`). Any other apostrophe is dropped.
const PRIME_WORDS = ['', 'prime', 'double-prime', 'triple-prime']
const PRIMES = /(^|[^a-z0-9])([a-z0-9])(′{1,3}|″|‴|'{1,3})(?=$|[^a-z0-9'′])/g

function primeCount(marks: string): number {
  if (marks === '″') return 2
  if (marks === '‴') return 3
  return Math.min(3, marks.length)
}

/** Kebab-case from a label, or null if nothing slug-worthy is left. */
export function slugify(label: string): string | null {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(PRIMES, (_, pre: string, ch: string, marks: string) => `${pre}${ch}-${PRIME_WORDS[primeCount(marks)]}`)
    .replace(/['’′″‴]/g, '') // any remaining apostrophe is punctuation: "don't" → "dont"
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
  return slug.length > 0 ? slug : null
}

/** `base`, or `base-2`, `base-3` … — the first one not in `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/** Every form-diagram span in the document. */
export function allSpans(doc: StrataDocument): Span[] {
  return doc.layers.flatMap((l) => (l.type === 'form-diagram' ? (l.data as FormDiagramData).spans : []))
}

/**
 * Slugs in use by spans and point markers (one namespace, so a commentary
 * link is never ambiguous), optionally ignoring some ids (the ones being
 * re-slugged).
 */
export function slugsInUse(doc: StrataDocument, except: Set<string> = new Set()): Set<string> {
  return new Set(
    [...allSpans(doc), ...doc.pointMarkers]
      .filter((s) => !except.has(s.id) && s.slug)
      .map((s) => s.slug as string),
  )
}

/**
 * Resolve slug collisions after a write. Where two spans share a slug, the one
 * that held it before the write keeps it; the newcomer gets the next free
 * suffix. Returns `next` unchanged when there's nothing to fix.
 */
export function resolveSlugCollisions(prev: StrataDocument | null, next: StrataDocument): StrataDocument {
  const holders = new Map<string, string>() // slug → span id that held it in `prev`
  if (prev) for (const s of allSpans(prev)) if (s.slug) holders.set(s.slug, s.id)

  // Visit in time order so a chain of new duplicates numbers left to right.
  const spans = allSpans(next).sort((a, b) => a.startTime - b.startTime)
  const bySlug = new Map<string, Span[]>()
  for (const s of spans) if (s.slug) bySlug.set(s.slug, [...(bySlug.get(s.slug) ?? []), s])

  const renamed = new Map<string, string>() // span id → new slug
  // Marker slugs are taken too: spans and markers share the namespace.
  const taken = new Set([...bySlug.keys(), ...next.pointMarkers.flatMap((m) => (m.slug ? [m.slug] : []))])
  for (const [slug, group] of bySlug) {
    if (group.length < 2) continue
    const keeperId = group.some((s) => s.id === holders.get(slug)) ? holders.get(slug) : group[0].id
    for (const s of group) {
      if (s.id === keeperId) continue
      const fresh = uniqueSlug(slug, taken)
      taken.add(fresh)
      renamed.set(s.id, fresh)
    }
  }
  if (renamed.size === 0) return next

  return {
    ...next,
    layers: next.layers.map((l) => {
      if (l.type !== 'form-diagram') return l
      const data = l.data as FormDiagramData
      if (!data.spans.some((s) => renamed.has(s.id))) return l
      return {
        ...l,
        data: { ...data, spans: data.spans.map((s) => (renamed.has(s.id) ? { ...s, slug: renamed.get(s.id)! } : s)) },
      }
    }),
  }
}
