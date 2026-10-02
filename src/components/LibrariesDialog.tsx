/**
 * LibrariesDialog — which optional libraries (packs) the Type list shows, and
 * vocabulary packs to import or share.
 *
 * Opened from the foot of the Type picker. Each pack is one row: a switch,
 * what it's for, how many types it has and a few of them, with the full list
 * a click away, so turning one on never adds an unknown. Packs only change
 * what the list shows; search reaches every type either way. Importing a
 * `.vocab.json` copies its types into this analysis (lib/vocabPack.ts).
 * Suggestions for the built-in vocabulary open a GitHub issue form.
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { LIBRARIES, builtInTerm, type Library } from '@/lib/vocabulary'
import { exportVocabPack, exportableCount, packSource, readVocabPack } from '@/lib/vocabPack'
import { downloadBlob, fileBaseName, pickTextFile } from '@/lib/fileIO'
import { suggestVocabularyUrl } from '@/lib/issues'

const SAMPLE = 4


function PackRow({ lib }: { lib: Library }) {
  const on = useUIStore((s) => s.enabledPacks.includes(lib.id))
  const setPackEnabled = useUIStore((s) => s.setPackEnabled)
  const [showAll, setShowAll] = useState(false)
  const terms = [...lib.spanTypes, ...lib.pointMarkerTypes].map((id) => builtInTerm(id)!).filter(Boolean)
  const names = terms.map((t) => t.name ?? t.label)
  const switchId = `pack-${lib.id}`
  return (
    <li className="flex gap-3 py-2.5">
      <Switch id={switchId} checked={on} onCheckedChange={(v) => setPackEnabled(lib.id, v)} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <label htmlFor={switchId} className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{lib.label}</span>
          <span className="text-xs text-muted-foreground">
            {terms.length} type{terms.length === 1 ? '' : 's'}
          </span>
        </label>
        <p className="text-xs text-muted-foreground">{lib.description}</p>
        {showAll ? (
          <>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-foreground">
              {terms.map((t) => (
                <li key={t.id} title={t.definition}>
                  {t.name && t.name !== t.label ? `${t.name} (${t.label})` : t.label}
                </li>
              ))}
            </ul>
            <a
              href={suggestVocabularyUrl(lib.label)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Suggest a change to {lib.label} ↗
            </a>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-foreground">
            {names.slice(0, SAMPLE).join(', ')}
            {names.length > SAMPLE && (
              <>
                {' '}
                <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setShowAll(true)}>
                  and {names.length - SAMPLE} more
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  )
}

export function LibrariesDialog() {
  const open = useUIStore((s) => s.librariesOpen)
  const setOpen = useUIStore((s) => s.setLibrariesOpen)
  const doc = useDocumentStore((s) => s.document)
  const [notice, setNotice] = useState<string[] | null>(null)
  if (!doc) return null

  const packs = LIBRARIES.filter((l) => l.tier === 'pack')
  const builtIns = LIBRARIES.filter((l) => l.tier === 'built-in').map((l) => l.label)
  const all = [...doc.vocabulary.spanTypes, ...doc.vocabulary.pointMarkerTypes, ...doc.vocabulary.modes]
  const imported = [...new Set(all.map((t) => t.source).filter((s): s is string => !!s))].map((src) => ({
    src,
    count: all.filter((t) => t.source === src).length,
  }))
  const ownCount = exportableCount(doc)

  // A pack's types are copied into the analysis, so it opens without the pack.
  async function importPack() {
    const raw = await pickTextFile('.json,application/json')
    if (raw === null) return
    try {
      const { pack, skipped: unreadable } = readVocabPack(raw)
      const result = useDocumentStore.getState().importVocabPack(pack)
      if (!result) return
      const skipped = [...unreadable, ...result.skipped]
      setNotice([
        `Added ${result.added} type${result.added === 1 ? '' : 's'} from “${packSource(pack)}”${result.updated ? ` and updated ${result.updated}` : ''}.`,
        ...(skipped.length ? [`Left out: ${skipped.join('; ')}.`] : []),
      ])
    } catch (err) {
      setNotice([err instanceof Error ? err.message : String(err)])
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setNotice(null)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Libraries</DialogTitle>
          <DialogDescription>
            Turn on a library to list its types in the Type menu. {builtIns.join(', ')} are always listed. Search finds
            every type, on or off.
          </DialogDescription>
        </DialogHeader>

        <ul className="-my-1 max-h-[45vh] divide-y divide-border overflow-y-auto pr-1">
          {packs.map((lib) => (
            <PackRow key={lib.id} lib={lib} />
          ))}
        </ul>

        <section className="border-t border-border pt-3">
          <h3 className="text-sm font-medium text-foreground">Packs from a file</h3>
          <p className="text-xs text-muted-foreground">
            A <code>.vocab.json</code> file someone has shared. Its types are copied into this analysis.
          </p>
          {imported.length > 0 && (
            <ul className="mt-1 text-xs text-foreground">
              {imported.map((p) => (
                <li key={p.src}>
                  {p.src} · {p.count} type{p.count === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="rounded border border-border px-2.5 py-1 text-xs hover:bg-accent" onClick={importPack}>
              Import a pack…
            </button>
            {ownCount > 0 && (
              <button
                type="button"
                className="rounded border border-border px-2.5 py-1 text-xs hover:bg-accent"
                title="Your own types in this analysis, without letters, as a .vocab.json file to share"
                onClick={() =>
                  downloadBlob(
                    new Blob([JSON.stringify(exportVocabPack(doc), null, 2)], { type: 'application/json' }),
                    `${fileBaseName(doc)}.vocab.json`,
                  )
                }
              >
                Save your {ownCount} type{ownCount === 1 ? '' : 's'} as a pack
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Missing a type, or think one is wrong?{' '}
            <a href={suggestVocabularyUrl()} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
              Suggest a change on GitHub ↗
            </a>
          </p>
          {notice && (
            <p role="status" className="mt-2 text-xs text-foreground">
              {notice.join(' ')}
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
