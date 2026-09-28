/**
 * File format versions and the upgrade path between them.
 *
 * The policy (docs/decisions.md, 2026-09-27):
 *   - Adding an OPTIONAL field does not change the version. Older files simply
 *     lack it, and the loader (lib/documentLoad.ts) supplies the default. Most
 *     changes are like this.
 *   - A change that alters what existing data MEANS, or that older files can't be
 *     read under without transformation (a rename, a restructure, a new required
 *     field), bumps FILE_FORMAT_VERSION and adds one entry to MIGRATIONS that
 *     rewrites a document from the previous version to the new one.
 *   - Documents are upgraded on load, one step at a time, and saved at the new
 *     version. A file from a NEWER version than this build is opened as-is with a
 *     warning; it is never "downgraded".
 *
 * Migrations are pure functions over plain JSON, so each one can be tested
 * against a real file from the version it upgrades.
 */

/** The file format this build writes. */
export const FILE_FORMAT_VERSION = 1

type Json = Record<string, unknown>

/**
 * MIGRATIONS[n] upgrades a version-n document to version n + 1. Empty while the
 * format is still at version 1; the first entry arrives with the first change
 * that needs one.
 */
export const MIGRATIONS: Record<number, (doc: Json) => Json> = {}

/** Upgrade a document to FILE_FORMAT_VERSION. Returns it unchanged if already current or newer. */
export function migrate(doc: Json): Json {
  let current = doc
  let version = typeof doc.fileFormatVersion === 'number' ? doc.fileFormatVersion : 1
  while (version < FILE_FORMAT_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`No migration from file format ${version} to ${version + 1}.`)
    current = { ...step(current), fileFormatVersion: version + 1 }
    version += 1
  }
  return current
}
