/**
 * CommentaryEditor — commentary edited in place in the stack, as Markdown.
 *
 * A text box that grows with its text, and a toolbar: bold, italic, code, a
 * heading, bulleted and numbered lists, a quote, a link to a span or marker
 * (picked by name, written [[slug]]), and the symbol palette. Ctrl/⌘+B and
 * Ctrl/⌘+I format; Esc or Ctrl/⌘+Enter finishes. Every change writes through
 * at once (the same text the Inspector shows), and toolbar edits go in as
 * input events, so a session's typing and formatting undo together.
 * docs/decisions.md, "Commentary in Markdown, Edited in Place".
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bold, Code, Heading, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formSpans } from '@/lib/layers'
import { PALETTE_SYMBOLS } from '@/lib/musicSymbols'
import { replaceSelection, toggleLinePrefix, toggleWrap, type Edit } from '@/lib/textEdit'
import type { StrataDocument } from '@/types/strata'

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`

/** Set a text box's value as typing would, so React's onChange sees it, then restore the selection. */
function applyEdit(el: HTMLTextAreaElement, edit: Edit) {
  el.focus()
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(el, edit.text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.setSelectionRange(edit.start, edit.end)
}

function ToolButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keep the text box's focus and selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className="flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

/** Spans and markers that can be linked to (they have a slug), searchable by name. */
function LinkPicker({ doc, onPick }: { doc: StrataDocument; onPick: (slug: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const targets = useMemo(() => {
    const spans = doc.layers.flatMap((l) =>
      formSpans(l)
        .filter((s) => s.slug)
        .map((s) => ({ slug: s.slug!, name: s.label || s.slug!, where: `${l.label} · ${mmss(s.startTime)}`, time: s.startTime })),
    )
    const markers = doc.pointMarkers
      .filter((m) => m.slug)
      .map((m) => ({ slug: m.slug!, name: m.label || m.slug!, where: `Marker · ${mmss(m.timestamp)}`, time: m.timestamp }))
    return [...spans, ...markers].sort((a, b) => a.time - b.time)
  }, [doc])
  const q = query.trim().toLowerCase()
  const shown = (q ? targets.filter((t) => t.name.toLowerCase().includes(q) || t.slug.includes(q)) : targets).slice(0, 50)
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setQuery('') }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Link to a span or marker"
          aria-label="Link to a span or marker"
          onMouseDown={(e) => e.preventDefault()}
          className="flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Link2 size={13} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 text-xs">
        <input
          autoFocus
          aria-label="Find a span or marker"
          placeholder="Find a span or marker…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && shown[0]) {
              e.preventDefault()
              setOpen(false)
              onPick(shown[0].slug)
            }
          }}
          className="mb-1.5 w-full rounded border border-border bg-card px-1.5 py-1 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
        />
        <div className="max-h-56 overflow-y-auto" role="listbox" aria-label="Spans and markers">
          {shown.length ? (
            shown.map((t) => (
              <button
                key={t.slug}
                role="option"
                aria-selected={false}
                onClick={() => {
                  setOpen(false)
                  onPick(t.slug)
                }}
                className="flex w-full items-baseline justify-between gap-2 rounded px-1.5 py-1 text-left hover:bg-accent"
              >
                <span className="truncate text-foreground">{t.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{t.where}</span>
              </button>
            ))
          ) : (
            <p className="px-1.5 py-1 text-muted-foreground">Nothing to link to. A span needs a label first.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function CommentaryEditor({
  doc,
  value,
  onChange,
  onDone,
  label,
}: {
  doc: StrataDocument
  value: string
  onChange: (text: string) => void
  onDone: () => void
  /** The text box's accessible name. */
  label: string
}) {
  const box = useRef<HTMLTextAreaElement>(null)
  const [symbols, setSymbols] = useState(false)
  // Grow with the text, from four lines.
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 88)}px`
  }, [value])

  const format = (f: (text: string, start: number, end: number) => Edit) => {
    const el = box.current
    if (el) applyEdit(el, f(el.value, el.selectionStart, el.selectionEnd))
  }
  const wrap = (mark: string) => format((t, a, b) => toggleWrap(t, a, b, mark))
  const lines = (kind: Parameters<typeof toggleLinePrefix>[3]) => format((t, a, b) => toggleLinePrefix(t, a, b, kind))
  const insert = (text: string) => format((t, a, b) => replaceSelection(t, a, b, text))

  return (
    <div className="flex flex-col rounded-md border border-border bg-card focus-within:ring-1 focus-within:ring-ring">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1 py-0.5" role="toolbar" aria-label="Formatting">
        <ToolButton label="Bold (Ctrl/⌘+B)" onPress={() => wrap('**')}><Bold size={13} aria-hidden /></ToolButton>
        <ToolButton label="Italic (Ctrl/⌘+I)" onPress={() => wrap('*')}><Italic size={13} aria-hidden /></ToolButton>
        <ToolButton label="Code" onPress={() => wrap('`')}><Code size={13} aria-hidden /></ToolButton>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <ToolButton label="Heading" onPress={() => lines('heading')}><Heading size={13} aria-hidden /></ToolButton>
        <ToolButton label="Bulleted list" onPress={() => lines('bullet')}><List size={13} aria-hidden /></ToolButton>
        <ToolButton label="Numbered list" onPress={() => lines('number')}><ListOrdered size={13} aria-hidden /></ToolButton>
        <ToolButton label="Quote" onPress={() => lines('quote')}><Quote size={13} aria-hidden /></ToolButton>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <LinkPicker
          doc={doc}
          onPick={(slug) =>
            format((t, a, b) => replaceSelection(t, a, b, a === b ? `[[${slug}]]` : `[[${slug}|${t.slice(a, b)}]]`))
          }
        />
        <ToolButton label="Insert a symbol" onPress={() => setSymbols((v) => !v)}>♭♯</ToolButton>
        <button
          type="button"
          onClick={onDone}
          className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
          title="Finish (Esc)"
        >
          Done
        </button>
      </div>
      {symbols && (
        <div className="flex flex-wrap gap-0.5 border-b border-border px-1 py-1" role="toolbar" aria-label="Symbols">
          {PALETTE_SYMBOLS.map((sym) => (
            <ToolButton key={sym} label={`Insert ${sym}`} onPress={() => insert(sym)}>{sym}</ToolButton>
          ))}
        </div>
      )}
      <textarea
        ref={box}
        autoFocus
        aria-label={label}
        value={value}
        placeholder="Write about this passage. Markdown works: **bold**, *italic*, - lists, ## headings, > quotes, [[links]]."
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey
          if (e.key === 'Escape' || (mod && e.key === 'Enter')) {
            e.preventDefault()
            e.stopPropagation()
            onDone()
          } else if (mod && (e.key === 'b' || e.key === 'i')) {
            e.preventDefault()
            wrap(e.key === 'b' ? '**' : '*')
          }
        }}
        className="min-h-[88px] w-full resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-foreground focus:outline-hidden"
      />
    </div>
  )
}
