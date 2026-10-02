/**
 * Links to Strata's GitHub issue forms (.github/ISSUE_TEMPLATE/). A form's
 * fields can be prefilled from the URL, so a report arrives with the app
 * version and browser already filled in.
 */
import { version as APP_VERSION } from '../../package.json'

const ISSUES = 'https://github.com/devinchaloux/strata/issues/new'

function issueUrl(template: string, fields: Record<string, string | undefined>): string {
  const q = new URLSearchParams({ template })
  for (const [k, v] of Object.entries(fields)) if (v) q.set(k, v)
  return `${ISSUES}?${q}`
}

/** A bug report or a request, with the version and browser filled in. */
export function reportIssueUrl(): string {
  return issueUrl('report.yml', {
    version: APP_VERSION,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  })
}

/** A suggestion for the built-in vocabulary, prefilled with the library when there is one. */
export function suggestVocabularyUrl(library?: string): string {
  return issueUrl('vocabulary.yml', { library })
}
