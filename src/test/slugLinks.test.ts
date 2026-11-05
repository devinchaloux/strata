import { describe, it, expect } from 'vitest'
import { slugLinksToMarkdown, slugLinksForExport, SLUG_PREFIX } from '@/widgets/written-analysis/markdownText'

const names: Record<string, string> = { 'drop-2': 'The Drop', odd: 'A [b]' }
const nameOf = (slug: string) => names[slug]

describe('slug links', () => {
  it('shows your own words when the link has them', () => {
    expect(slugLinksToMarkdown('see [[drop-2|the second drop]]', nameOf)).toBe(`see [the second drop](${SLUG_PREFIX}drop-2)`)
  })

  it("shows the span's label for a bare link", () => {
    expect(slugLinksToMarkdown('see [[drop-2]]', nameOf)).toBe(`see [The Drop](${SLUG_PREFIX}drop-2)`)
  })

  it('falls back to the slug when nothing has a label', () => {
    expect(slugLinksToMarkdown('see [[gone]]', nameOf)).toBe(`see [gone](${SLUG_PREFIX}gone)`)
    expect(slugLinksToMarkdown('see [[drop-2]]')).toBe(`see [drop-2](${SLUG_PREFIX}drop-2)`)
  })

  it('escapes brackets in a label so the link stays whole', () => {
    expect(slugLinksToMarkdown('[[odd]]', nameOf)).toBe(`[A \\[b\\]](${SLUG_PREFIX}odd)`)
  })

  it('uses the label in the Markdown export too', () => {
    expect(slugLinksForExport('[[drop-2]] and [[gone]]', new Set(['drop-2']), nameOf)).toBe('[The Drop](#drop-2) and gone')
  })
})
