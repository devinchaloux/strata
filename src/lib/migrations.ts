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
export const FILE_FORMAT_VERSION = 2

type Json = Record<string, unknown>

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A copy of `obj` without `key`, or `obj` itself if it has none. */
function without(obj: Json, key: string): Json {
  if (!(key in obj)) return obj
  const rest = { ...obj }
  delete rest[key]
  return rest
}

/** `doc.list` with each object entry passed through `fn`; anything else is left as it is. */
function mapList(doc: Json, list: string, fn: (item: Json) => Json): Json {
  const items = doc[list]
  return Array.isArray(items) ? { ...doc, [list]: items.map((x) => (isObj(x) ? fn(x) : x)) } : doc
}

/**
 * MIGRATIONS[n] upgrades a version-n document to version n + 1.
 *
 * 1 → 2 (docs/decisions.md, "Schema Review: Three Fields Cut"): drops
 * `sharedTimePoints` (never written by the app; the beat grid replaced the
 * points it was meant to hold), each form layer's `hierarchicalEnforcement`
 * (never used), and `confidence` on spans and point markers (not drawn or
 * queried, and cut by the maintainer).
 */
export const MIGRATIONS: Record<number, (doc: Json) => Json> = {
  1: (doc) => {
    let out = without(doc, 'sharedTimePoints')
    out = mapList(out, 'pointMarkers', (m) => without(m, 'confidence'))
    out = mapList(out, 'layers', (layer) => {
      if (layer.type !== 'form-diagram' || !isObj(layer.data)) return layer
      let data = without(layer.data, 'hierarchicalEnforcement')
      data = mapList(data, 'spans', (s) => without(s, 'confidence'))
      return { ...layer, data }
    })
    return out
  },
}

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
