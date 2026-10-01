/**
 * TypePicker — chooses a span's or point marker's `type` from the vocabulary.
 *
 * Opened, it shows the working set first: the types this file already uses,
 * then (for spans) the letter maker, then each library as a collapsed group,
 * with the packs the analyst has switched on after the built-in libraries.
 * Typing searches every library, packs included whether or not they're on, so
 * a term is never out of reach; a typed letter ("B′") offers that letter, and
 * any other text can become a type of this file's own. Arrow keys and Enter
 * work through the list. lib/vocabulary.ts holds the terms; docs/decisions.md,
 * "Vocabulary Libraries", the reasons.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { inputClass } from '@/components/Field'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { formSpans } from '@/lib/layers'
import { slugify } from '@/lib/slug'
import {
  LIBRARIES,
  builtInTerm,
  findTerm,
  isLetterId,
  letterTerm,
  parseLetter,
  searchTerms,
  termTitle,
  type PickerTerm,
  type TermKind,
} from '@/lib/vocabulary'
import type { VocabTerm } from '@/types/strata'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const PRIMES = ['', '′', '″']

interface Row {
  key: string
  term?: PickerTerm
  /** Text for a row that isn't a term (None, Add …). */
  text?: string
  note?: string
  /** A term to add to the file's vocabulary before picking it. */
  add?: VocabTerm
  id: string | null
  /** Shown as a compact chip (the file's letters) rather than a line. */
  chip?: boolean
}

/** One choosable line: the label, its full name, and what it counts as. */
function TermRow({ row, active, onPick, onHover }: { row: Row; active: boolean; onPick: () => void; onHover: () => void }) {
  const t = row.term
  const counts = t?.broader?.map((b) => builtInTerm(b)?.name ?? builtInTerm(b)?.label ?? b)
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onPick}
      title={t?.definition}
      className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-[12px] ${active ? 'bg-accent' : ''}`}
    >
      {t ? (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-baseline gap-2">
            <span className="font-medium text-foreground">{t.label}</span>
            {t.name && t.name !== t.label && <span className="truncate text-muted-foreground">{t.name}</span>}
          </span>
          {counts?.length ? <span className="text-[10px] text-muted-foreground">counts as {counts.join(', ')}</span> : null}
        </span>
      ) : (
        <span className="text-foreground">{row.text}</span>
      )}
      {row.note && <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted-foreground">{row.note}</span>}
    </button>
  )
}

export function TypePicker({
  kind,
  value,
  mixed,
  onPick,
}: {
  kind: TermKind
  value: string | null | undefined
  /** Several selected items disagree. */
  mixed?: boolean
  onPick: (id: string | null, term?: PickerTerm) => void
}) {
  const doc = useDocumentStore((s) => s.document)
  const addVocabTerm = useDocumentStore((s) => s.addVocabTerm)
  const enabledPacks = useUIStore((s) => s.enabledPacks)
  const setPackEnabled = useUIStore((s) => s.setPackEnabled)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const [primes, setPrimes] = useState(0)
  const [active, setActive] = useState(0)
  const [showPacks, setShowPacks] = useState(false)

  const list = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  const custom = useMemo(() => doc?.vocabulary[list] ?? [], [doc, list])
  const libKey = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  const current = findTerm(value, kind, custom)

  // The types this file already uses, letters in order, then the rest A–Z.
  const inFile = useMemo(() => {
    if (!doc) return []
    const used =
      kind === 'span' ? doc.layers.flatMap(formSpans).map((s) => s.type) : doc.pointMarkers.map((m) => m.type)
    const ids = [...new Set([...custom.map((t) => t.id), ...used.filter((t): t is string => !!t)])]
    return ids
      .map((id) => findTerm(id, kind, custom))
      .filter((t): t is PickerTerm => !!t)
      .sort((a, b) => Number(!isLetterId(a.id)) - Number(!isLetterId(b.id)) || a.label.localeCompare(b.label))
  }, [doc, custom, kind])

  const libraries = LIBRARIES.filter(
    (l) => l[libKey].length > 0 && (l.tier === 'built-in' || enabledPacks.includes(l.id)),
  )
  const packs = LIBRARIES.filter((l) => l.tier === 'pack' && l[libKey].length > 0)

  // ── The rows, in display order, so arrow keys can walk them ──
  const sections: { title?: string; lib?: string; rows: Row[] }[] = []
  const q = query.trim()
  if (q) {
    const letter = kind === 'span' ? parseLetter(q) : null
    const rows: Row[] = []
    if (letter) {
      const t = letterTerm(letter.letter, letter.primes)
      rows.push({ key: 'letter', id: t.id, add: t, term: { ...t, kind: 'span' }, note: 'letter' })
    }
    for (const hit of searchTerms(q, kind, custom).slice(0, 40)) {
      if (letter && isLetterId(hit.term.id)) continue
      const lib = hit.libraries[0]
      rows.push({
        key: hit.term.id,
        id: hit.term.id,
        term: hit.term,
        note: hit.term.custom ? 'this file' : lib ? (lib.tier === 'pack' ? `${lib.label} · pack` : lib.label) : undefined,
      })
    }
    const newId = slugify(q)
    if (!letter && newId && !findTerm(newId, kind, custom) && !builtInTerm(newId)) {
      rows.push({ key: 'add', id: newId, add: { id: newId, label: q, kind }, text: `Add “${q}” as a type in this file` })
    }
    sections.push({ rows })
  } else {
    const top: Row[] = []
    if (value || mixed) top.push({ key: 'none', id: null, text: 'None' })
    top.push(...inFile.map((t) => ({ key: `file-${t.id}`, id: t.id, term: t, chip: isLetterId(t.id) })))
    sections.push({ title: inFile.length ? 'In this file' : undefined, rows: top })
    for (const lib of libraries) {
      const isOpen = expanded.includes(lib.id)
      sections.push({
        title: lib.label,
        lib: lib.id,
        rows: isOpen
          ? lib[libKey].map((id) => ({ key: `${lib.id}-${id}`, id, term: builtInTerm(id) }))
          : [],
      })
    }
  }
  const flat = sections.flatMap((s) => [...s.rows.filter((r) => r.chip), ...s.rows.filter((r) => !r.chip)])

  function pick(row: Row) {
    withHistoryGroup(newGestureKey('type-pick'), () => {
      if (row.add) addVocabTerm(list, row.add)
      onPick(row.id, row.term)
    })
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = flat.length
      if (n) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      pick(flat[active])
    }
  }

  const triggerText = mixed ? 'Mixed' : current ? termTitle(current) : value ?? 'None'
  let index = 0

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery('')
          setActive(0)
          setShowPacks(false)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={`${inputClass} flex items-center justify-between text-left`} title={current?.definition}>
          <span className={current || value ? 'truncate text-foreground' : 'text-muted-foreground'}>{triggerText}</span>
          <ChevronDown size={12} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem] p-0 text-xs" onKeyDown={onKeyDown}>
        <div className="border-b border-border p-2">
          <input
            autoFocus
            aria-label="Search the vocabulary"
            className={inputClass}
            placeholder={kind === 'span' ? 'Search every library, or type a letter (B′)' : 'Search every library'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-label={kind === 'span' ? 'Span types' : 'Marker types'}>
          {sections.map((s, si) => (
            <div key={s.lib ?? `s${si}`}>
              {s.lib ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-1 px-2 pb-0.5 pt-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded((x) => (x.includes(s.lib!) ? x.filter((l) => l !== s.lib) : [...x, s.lib!]))}
                  title={LIBRARIES.find((l) => l.id === s.lib)?.description}
                >
                  {s.rows.length ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  {s.title}
                </button>
              ) : (
                s.title && (
                  <div className="px-2 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.title}</div>
                )
              )}
              {s.rows.some((r) => r.chip) && (
                <div className="flex flex-wrap gap-1 px-2 py-1">
                  {s.rows.filter((r) => r.chip).map((row) => {
                    const i = index++
                    return (
                      <button
                        key={row.key}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(row)}
                        className={`h-5 min-w-6 rounded border border-border px-1 text-[11px] ${i === active ? 'bg-accent' : ''}`}
                      >
                        {row.term?.label}
                      </button>
                    )
                  })}
                </div>
              )}
              {s.rows.filter((r) => !r.chip).map((row) => {
                const i = index++
                return <TermRow key={row.key} row={row} active={i === active} onPick={() => pick(row)} onHover={() => setActive(i)} />
              })}
              {/* The letter maker sits under the file's own types: letters are
                  made, not listed, so A, A′ and A″ always look alike. */}
              {!q && si === 0 && kind === 'span' && (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <span className="mr-1 text-[10px] uppercase tracking-wide text-muted-foreground">Letter</span>
                  {LETTERS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="h-5 min-w-5 rounded border border-border px-1 text-[11px] hover:bg-accent"
                      onClick={() => {
                        const t = letterTerm(l, primes)
                        pick({ key: t.id, id: t.id, add: t, term: { ...t, kind: 'span' } })
                      }}
                    >
                      {l}
                      {PRIMES[primes]}
                    </button>
                  ))}
                  <div className="ml-auto flex overflow-hidden rounded border border-border" role="radiogroup" aria-label="Primes">
                    {PRIMES.map((p, n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={primes === n}
                        title={n === 0 ? 'No prime' : n === 1 ? 'Prime' : 'Double prime'}
                        className={`w-5 text-[11px] ${primes === n ? 'bg-accent text-foreground' : 'text-muted-foreground'}`}
                        onClick={() => setPrimes(n)}
                      >
                        {p || '–'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {q && !flat.length && <p className="px-2 py-2 text-muted-foreground">Nothing matches.</p>}
        </div>

        {!q && (
          <div className="border-t border-border p-2">
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowPacks((v) => !v)}
            >
              {showPacks ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              Packs ({enabledPacks.filter((p) => packs.some((l) => l.id === p)).length} of {packs.length} on)
            </button>
            {showPacks && (
              <div className="mt-1 flex flex-col gap-0.5">
                {packs.map((p) => (
                  <label key={p.id} className="flex items-baseline gap-2 text-[11px]" title={p.description}>
                    <input
                      type="checkbox"
                      checked={enabledPacks.includes(p.id)}
                      onChange={(e) => setPackEnabled(p.id, e.target.checked)}
                    />
                    <span className="text-foreground">{p.label}</span>
                    <span className="truncate text-muted-foreground">{p.description}</span>
                  </label>
                ))}
                <p className="mt-1 text-[10px] text-muted-foreground">Search finds pack terms even when a pack is off.</p>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
