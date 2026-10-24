/**
 * Commentary as static HTML for the commentary export (commentary.ts), from
 * the same Markdown renderer as the app, so the two read alike.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { CommentaryMarkdown } from './CommentaryMarkdown'

export function commentaryMarkdownHtml(text: string, exists: (slug: string) => boolean, targets: Set<string>): string {
  return renderToStaticMarkup(<CommentaryMarkdown text={text} exists={exists} exportTargets={targets} />)
}
