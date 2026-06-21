/**
 * Slug generation from a span label.
 *
 * The slug is the stable human-readable reference key (used for inter-widget
 * links and embed targeting). v1 generates a simple kebab-case slug from the
 * label. Cross-span de-duplication (appending -2, -3 by chronological order)
 * is a later refinement — see docs/decisions.md open notes.
 */
export function slugify(label: string): string | null {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '') // drop apostrophes/primes so "A'" → "a"
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
  return slug.length > 0 ? slug : null
}
