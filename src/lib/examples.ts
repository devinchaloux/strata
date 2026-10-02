/**
 * The example analyses. Each is an ordinary `.strata` file in `public/demos/`,
 * which the app serves at `/demos/<file>`, and opens the way a shared link
 * does: in the reading view, with "Edit a copy" a click away. Because an
 * example is just a shared link to a file on Strata's own address, a page
 * elsewhere (a website, a syllabus) can link straight to one.
 * docs/decisions.md, "Example Analyses".
 *
 * Adding one: put the file in public/demos/ and add a line here. The files are
 * CC BY 4.0, not MIT (public/demos/README.md).
 */
import { shareUrl } from '@/lib/shareLink'

export interface Example {
  /** File name in public/demos/. */
  file: string
  title: string
  artist: string
}

export const EXAMPLES: Example[] = [{ file: 'alive.strata', title: 'Alive', artist: 'Krewella' }]

/** The example file's own address, on whatever origin the app is served from. */
export function exampleFileUrl(example: Example, origin: string): string {
  return new URL(`/demos/${example.file}`, origin).toString()
}

/** The Strata link that opens an example: the app's address with `?src=` set to the file. */
export function exampleLink(example: Example, pageUrl: string): string {
  return shareUrl(exampleFileUrl(example, new URL(pageUrl).origin), pageUrl)
}
