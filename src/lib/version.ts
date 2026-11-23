/**
 * Which build of Strata this is: the package version, raised for each named
 * release, and the commit it was built from, which tells apart the builds
 * between releases (docs/decisions.md, "Strata's Version in Help").
 */
import { version } from '../../package.json'

export const APP_VERSION: string = version

/** The short commit, set at build time by vite.config.ts; "dev" when git isn't there. */
export const BUILD_COMMIT: string = __STRATA_COMMIT__

/** "0.1.0 (b88f438)": what Help shows and a report carries. */
export const versionLabel = (): string => `${APP_VERSION} (${BUILD_COMMIT})`
