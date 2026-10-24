/**
 * Copy and Paste for spans in the Inspector (store/spanClipboard.ts): Copy the
 * span shown, Paste the chosen parts of the copied one onto the selection, and
 * a small menu to choose those parts (remembered; Ctrl/⌘+V uses them too).
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PASTE_FIELDS, copySpan, pasteOnto, useSpanClipboard } from '@/store/spanClipboard'

const button = 'rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40'

/** Copy, for the one span shown. */
export function CopyButton({ spanId }: { spanId: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={button}
      title="Copy this span (Ctrl/⌘+C), to paste its label and type onto others"
      onClick={() => {
        if (!copySpan(spanId)) return
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/** Paste onto the selection, with the menu of what to paste. */
export function PasteButton({ spanIds }: { spanIds: string[] }) {
  const copied = useSpanClipboard((s) => s.copied)
  const fields = useSpanClipboard((s) => s.fields)
  const setFields = useSpanClipboard((s) => s.setFields)
  const targets = spanIds.filter((id) => id !== copied?.span.id)
  const from = copied ? copied.span.label || copied.span.type || 'the copied span' : null
  const names = PASTE_FIELDS.filter((f) => fields.includes(f.id)).map((f) => f.name.toLowerCase())
  return (
    <span className="inline-flex">
      <button
        className={`${button} rounded-r-none`}
        disabled={!copied || !targets.length || !fields.length}
        onClick={() => pasteOnto(spanIds)}
        title={copied ? `Paste ${names.join(', ') || 'nothing'} from “${from}” (Ctrl/⌘+V)` : 'Copy a span first (Ctrl/⌘+C)'}
      >
        Paste
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button className={`${button} -ml-px rounded-l-none px-1`} aria-label="What to paste" title="What to paste">
            <ChevronDown size={12} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2 text-xs">
          <p className="px-1 pb-1 font-medium text-foreground">Paste includes</p>
          {PASTE_FIELDS.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
              <input
                type="checkbox"
                checked={fields.includes(f.id)}
                onChange={(e) => setFields(e.target.checked ? [...fields, f.id] : fields.filter((x) => x !== f.id))}
              />
              {f.name}
            </label>
          ))}
          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
            {copied ? `Copied: “${from}”.` : 'Nothing copied yet.'} Ctrl/⌘+C copies a span; Ctrl/⌘+V pastes these.
          </p>
        </PopoverContent>
      </Popover>
    </span>
  )
}
