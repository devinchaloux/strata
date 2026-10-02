/**
 * Recognising a tab left open across a release. A few parts of the app (the
 * SVG export's renderer) load only when first used. Each release replaces those
 * files with new names, so a tab opened before the release asks for a file the
 * server no longer has, and the browser rejects the import. Reloading fetches
 * the current release. docs/decisions.md, "Releases and Open Tabs".
 */

// Each browser words the failure differently: Chrome and Edge, Firefox, Safari.
const STALE_IMPORT = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
]

/** Whether an error is a lazily loaded part of the app that is gone from the server. */
export function isStaleBuildError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return STALE_IMPORT.some((re) => re.test(message))
}

/** What to tell the analyst: the fix is a reload, and their work is safe if they save first. */
export const STALE_BUILD_MESSAGE = {
  title: 'Strata has been updated',
  lines: [
    'This tab is still running the earlier version, and part of it is no longer on the server.',
    'Save your analysis, then reload the page to use the current version.',
  ],
}
