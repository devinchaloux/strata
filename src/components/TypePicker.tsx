/**
 * TypePicker — chooses a span's or point marker's `type` from the vocabulary.
 *
 * Opened beside the Inspector, it shows the working set first: the types this
 * file already uses (its letters as chips, with the next letter offered), then
 * each library as a collapsed group, with the packs the analyst has switched
 * on after the built-in libraries.
 * Typing searches every library, packs included whether or not they're on, so
 * a term is never out of reach; a typed letter ("B′") offers that letter, and
 * any other text can become a type of this file's own. Arrow keys and Enter
 * work through the list. lib/vocabulary.ts holds the terms; docs/decisions.md,
 * "Vocabulary Libraries", the reasons.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { inputClass } from '@/components/Field'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { slugify } from '@/lib/slug'
import { typeSuggestions } from '@/lib/typeSuggestions'
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
  /** Set apart from the terms ([none], next letter). */
  muted?: boolean
}

/** One choosable line: the label, its full name, and what it counts as. */
function TermRow({ row, active, current, onPick, onHover }: { row: Row; active: boolean; current: boolean; onPick: () => void; onHover: () => void }) {
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
      className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-[13px] ${active ? 'bg-accent' : ''}`}
    >
      {t ? (
        <span className="flex min-w-0 flex-col">
          <span className="flex items-baseline gap-2">
            {current && <span className="sr-only">Current: </span>}
            <span className={`font-medium text-foreground ${current ? 'underline decoration-2 underline-offset-2' : ''}`}>{t.label}</span>
            {t.name && t.name !== t.label && <span className="truncate text-muted-foreground">{t.name}</span>}
          </span>
          {counts?.length ? <span className="text-[11px] text-muted-foreground">counts as {counts.join(', ')}</span> : null}
        </span>
      ) : (
        <span className={row.muted ? 'italic text-muted-foreground' : 'text-foreground'}>{row.text}</span>
      )}
      {row.note && <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">{row.note}</span>}
    </button>
  )
}

export function TypePicker({
  kind,
  value,
  mixed,
  onPick,
  layerId,
}: {
  kind: TermKind
  value: string | null | undefined
  /** The layer being typed, for "In this layer" and its suggestions. */
  layerId?: string
  /** Several selected items disagree. */
  mixed?: boolean
  onPick: (id: string | null, term?: PickerTerm) => void
}) {
  const doc = useDocumentStore((s) => s.document)
  const addVocabTerm = useDocumentStore((s) => s.addVocabTerm)
  const enabledPacks = useUIStore((s) => s.enabledPacks)
  const setLibrariesOpen = useUIStore((s) => s.setLibrariesOpen)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const [active, setActive] = useState(0)
  // The quick-type bar's "/" (and its More… button) open the span picker.
  const typePickerRequest = useUIStore((s) => s.typePickerRequest)
  useEffect(() => {
    if (typePickerRequest && kind === 'span') {
      setQuery('')
      setActive(0)
      setOpen(true)
    }
  }, [typePickerRequest, kind])

  const list = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  const custom = useMemo(() => doc?.vocabulary[list] ?? [], [doc, list])
  const libKey = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  const current = findTerm(value, kind, custom)

  // What the file and this layer already use, in order of first appearance
  // (Intro, Verse, Chorus …), and the library the layer seems to be drawing
  // on, whose unused types are suggested (lib/typeSuggestions.ts).
  const { inLayer, elsewhere, suggested, nextLetter: next } = useMemo(
    () => (doc ? typeSuggestions(doc, kind, layerId) : { inLayer: [], elsewhere: [], suggested: null, nextLetter: 'A' }),
    [doc, kind, layerId],
  )
  const inFile = [...inLayer, ...elsewhere]

  const libraries = LIBRARIES.filter(
    (l) => l[libKey].length > 0 && (l.tier === 'built-in' || enabledPacks.includes(l.id)),
  )
  // Imported packs, by the source each term records.
  const imported = [...new Set(custom.map((t) => t.source).filter((s): s is string => !!s))]

  // ── The rows, in display order, so arrow keys can walk them ──
  const sections: { title?: string; lib?: string; rows: Row[]; lettered?: boolean }[] = []
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
        note: hit.term.custom ? (custom.find((c) => c.id === hit.term.id)?.source ?? 'this file') : lib ? (lib.tier === 'pack' ? `${lib.label} · pack` : lib.label) : undefined,
      })
    }
    const newId = slugify(q)
    if (!letter && newId && !findTerm(newId, kind, custom) && !builtInTerm(newId)) {
      rows.push({ key: 'add', id: newId, add: { id: newId, label: q, kind }, text: `Add “${q}” as a type in this file` })
    }
    sections.push({ rows })
  } else {
    // [none] first and on its own, so clearing a type never reads as a term.
    if (value || mixed) sections.push({ rows: [{ key: 'none', id: null, text: '[none]', muted: true }] })
    const rowsOf = (terms: PickerTerm[], prefix: string): Row[] =>
      terms.map((t) => ({ key: `${prefix}-${t.id}`, id: t.id, term: t, chip: isLetterId(t.id) }))
    // The next letter after the highest one this file uses (A in a new file).
    const nextRow: Row[] = []
    if (kind === 'span' && next) {
      const t = letterTerm(next, 0)
      nextRow.push({ key: 'next-letter', id: t.id, add: t, term: { ...t, kind: 'span' }, chip: true, muted: true })
    }
    if (layerId && inLayer.length) {
      // Offer the next letter only on a layer that is lettered.
      const lettered = inLayer.some((t) => isLetterId(t.id))
      sections.push({ title: 'In this layer', rows: [...rowsOf(inLayer, 'layer'), ...(lettered ? nextRow : [])], lettered })
      if (elsewhere.length) sections.push({ title: 'Elsewhere in this file', rows: rowsOf(elsewhere, 'file') })
    } else {
      sections.push({ title: 'In this file', rows: [...rowsOf(inFile, 'file'), ...nextRow] })
    }
    // Recommendations: the rest of the library this layer draws on, so the
    // next type is usually one click away without searching.
    if (suggested?.terms.length) {
      const SHOWN = 8
      sections.push({
        title: `Suggested from ${suggested.lib.label}`,
        rows: [
          ...rowsOf(suggested.terms.slice(0, SHOWN), 'suggest'),
          ...(suggested.terms.length > SHOWN
            ? [{ key: 'suggest-more', id: '__expand__', text: `All of ${suggested.lib.label}…`, muted: true }]
            : []),
        ],
      })
    }
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
    for (const src of imported) {
      const key = `source:${src}`
      sections.push({
        title: src,
        lib: key,
        rows: expanded.includes(key)
          ? custom.filter((t) => t.source === src).map((t) => ({ key: `${key}-${t.id}`, id: t.id, term: findTerm(t.id, kind, custom) }))
          : [],
      })
    }
  }
  const flat = sections.flatMap((s) => [...s.rows.filter((r) => r.chip), ...s.rows.filter((r) => !r.chip)])

  function pick(row: Row) {
    if (row.id === '__expand__' && suggested) {
      // Open the library's full group below rather than choosing a type.
      setExpanded((x) => (x.includes(suggested.lib.id) ? x : [...x, suggested.lib.id]))
      return
    }
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

  const triggerText = mixed ? 'Mixed' : current ? termTitle(current) : value ?? '[none]'
  let index = 0

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery('')
          setActive(0)
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Type: ${triggerText}`}
          className={`${inputClass} flex items-center justify-between text-left`}
          title={current?.definition}
        >
          <span className={current || value ? 'truncate text-foreground' : 'text-muted-foreground'}>{triggerText}</span>
          <ChevronDown size={12} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        collisionPadding={12}
        className="flex w-104 flex-col p-0 text-xs"
        style={{ maxHeight: 'min(36rem, var(--radix-popover-content-available-height))' }}
        onKeyDown={onKeyDown}
      >
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

        <div className="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-label={kind === 'span' ? 'Span types' : 'Marker types'}>
          {sections.map((s, si) => (
            <div key={s.lib ?? `s${si}`}>
              {s.lib ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-1 px-2 pb-0.5 pt-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded((x) => (x.includes(s.lib!) ? x.filter((l) => l !== s.lib) : [...x, s.lib!]))}
                  title={LIBRARIES.find((l) => l.id === s.lib)?.description}
                >
                  {s.rows.length ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  {s.title}
                </button>
              ) : (
                s.title && (
                  <div className="px-2 pb-0.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.title}</div>
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
                        title={row.muted ? 'The next letter' : row.term?.label}
                        className={`h-6 min-w-7 rounded border px-1.5 text-xs ${row.muted ? 'border-dashed border-muted-foreground text-muted-foreground' : row.id === value ? 'border-2 border-foreground font-medium text-foreground' : 'border-border text-foreground'} ${i === active ? 'bg-accent' : ''}`}
                      >
                        {row.muted ? `+ ${row.term?.label}` : row.term?.label}
                      </button>
                    )
                  })}
                </div>
              )}
              {s.rows.filter((r) => !r.chip).map((row) => {
                const i = index++
                return <TermRow key={row.key} row={row} active={i === active} current={!!row.id && row.id === value} onPick={() => pick(row)} onHover={() => setActive(i)} />
              })}
              {/* Letters are made, not listed: any letter A–Z with up to three
                  primes, typed in the search box. */}
              {!q && (s.title === 'In this file' || s.lettered) && kind === 'span' && (
                <p className="px-2 pb-1 text-xs text-muted-foreground">
                  Any letter: type it and press Enter (K, or B&apos; for B′, C&apos;&apos; for C″).
                </p>
              )}
            </div>
          ))}
          {q && !flat.length && <p className="px-2 py-2 text-muted-foreground">Nothing matches.</p>}
        </div>

        {!q && (
          <div className="border-t border-border px-2 py-1.5">
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => {
                setOpen(false)
                setLibrariesOpen(true)
              }}
            >
              More libraries…
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
