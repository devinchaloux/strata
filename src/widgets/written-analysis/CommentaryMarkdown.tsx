/**
 * CommentaryMarkdown — commentary text rendered as Markdown (react-markdown),
 * in the app and, as static HTML, in the commentary export, so the two agree.
 *
 * Commentary comes from files people share, so only a set of plain elements is
 * drawn (paragraphs, emphasis, code, links, lists, headings, quotes, rules);
 * raw HTML is never rendered (an angle bracket shows as typed: "<tonic>",
 * "I < V") and images are dropped (a shared file shouldn't
 * load anything from elsewhere). Strata's own [[slug]] and [[slug|text]] links
 * become internal links: in the app they select that span or marker and play
 * from it; in the export they jump to its section. Other links open in a new
 * tab. docs/decisions.md, "Commentary in Markdown, Edited in Place".
 */
import Markdown, { type Components } from 'react-markdown'
import { SLUG_PREFIX, escapeAngles, slugLinksToMarkdown } from './markdownText'

const ALLOWED = ['p', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'br']

export function CommentaryMarkdown({
  text,
  large = false,
  exists,
  onFollow,
  exportTargets,
}: {
  text: string
  /** The reading view's larger type. */
  large?: boolean
  /** Whether a slug names a span or marker; a link to one that doesn't reads as plain text. */
  exists: (slug: string) => boolean
  /** In the app: what clicking a [[slug]] link does. */
  onFollow?: (slug: string) => void
  /** In the export: slugs with a section of their own, which links jump to. */
  exportTargets?: Set<string>
}) {
  const body = large ? 'text-[17px]' : 'text-[14px]'
  const link: Components['a'] = ({ href, children }) => {
    if (href?.startsWith(SLUG_PREFIX)) {
      const slug = href.slice(SLUG_PREFIX.length)
      if (!exists(slug)) return <span title={`Nothing has the slug "${slug}"`}>{children}</span>
      if (exportTargets) return exportTargets.has(slug) ? <a href={`#${slug}`}>{children}</a> : <>{children}</>
      return (
        <button
          type="button"
          className="text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          onClick={() => onFollow?.(slug)}
          title={`Go to ${slug}`}
        >
          {children}
        </button>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={exportTargets ? undefined : 'text-primary underline underline-offset-2'}>
        {children}
      </a>
    )
  }
  // The export page has its own stylesheet: plain elements, links resolved.
  const components: Components = exportTargets ? { a: link } : {
    p: ({ children }) => <p className={`max-w-[65ch] leading-relaxed text-foreground ${body}`}>{children}</p>,
    h1: ({ children }) => <h3 className={`font-semibold text-foreground ${large ? 'text-lg' : 'text-[15px]'}`}>{children}</h3>,
    h2: ({ children }) => <h3 className={`font-semibold text-foreground ${large ? 'text-lg' : 'text-[15px]'}`}>{children}</h3>,
    h3: ({ children }) => <h4 className={`font-semibold text-foreground ${body}`}>{children}</h4>,
    h4: ({ children }) => <h4 className={`font-semibold text-foreground ${body}`}>{children}</h4>,
    h5: ({ children }) => <h4 className={`font-semibold text-foreground ${body}`}>{children}</h4>,
    h6: ({ children }) => <h4 className={`font-semibold text-foreground ${body}`}>{children}</h4>,
    ul: ({ children }) => <ul className={`max-w-[65ch] list-disc space-y-0.5 pl-5 leading-relaxed text-foreground ${body}`}>{children}</ul>,
    ol: ({ children }) => <ol className={`max-w-[65ch] list-decimal space-y-0.5 pl-5 leading-relaxed text-foreground ${body}`}>{children}</ol>,
    blockquote: ({ children }) => <blockquote className="max-w-[65ch] border-l-2 border-border pl-3 italic text-muted-foreground">{children}</blockquote>,
    code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
    pre: ({ children }) => <pre className="max-w-[65ch] overflow-x-auto rounded bg-muted p-2 text-[13px]">{children}</pre>,
    hr: () => <hr className="max-w-[65ch] border-border" />,
    a: link,
  }
  return (
    <Markdown allowedElements={ALLOWED} unwrapDisallowed skipHtml components={components}>
      {slugLinksToMarkdown(escapeAngles(text))}
    </Markdown>
  )
}
