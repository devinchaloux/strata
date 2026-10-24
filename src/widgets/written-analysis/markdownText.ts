/**
 * Strata's [[slug]] links inside Markdown commentary (CommentaryMarkdown.tsx).
 * [[slug]] or [[slug|shown text]] names a span or point marker by its slug.
 */

/** Where a [[slug]] link points once it is a Markdown link. */
export const SLUG_PREFIX = '#strata-slug:'

const SLUG_LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g

/** [[slug]] and [[slug|text]] as Markdown links CommentaryMarkdown recognises. */
export function slugLinksToMarkdown(text: string): string {
  return text.replace(SLUG_LINK, (_, slug: string, shown?: string) => `[${shown ?? slug}](${SLUG_PREFIX}${slug})`)
}

/**
 * For the Markdown export: a link to a slug with a section of its own becomes
 * an in-page link to it; any other becomes its text.
 */
export function slugLinksForExport(text: string, targets: Set<string>): string {
  return text.replace(SLUG_LINK, (_, slug: string, shown?: string) => (targets.has(slug) ? `[${shown ?? slug}](#${slug})` : shown ?? slug))
}

/**
 * Angle brackets outside code, as entities, so Markdown shows them as typed:
 * commentary is no place for HTML, and "<tonic>" would otherwise be read as a
 * tag and vanish. Inside `code` and fenced blocks they already show as typed.
 */
export function escapeAngles(text: string): string {
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/</g, '&lt;')))
    .join('')
}
