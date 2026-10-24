/**
 * Copy and Paste for spans in the Inspector (store/spanClipboard.ts): Copy the
 * selection, Paste the chosen parts of what's copied onto it (one copied span
 * onto any number; several onto as many, in time order), and a small menu to
 * choose those parts (remembered; Ctrl/⌘+V uses them too).
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PASTE_FIELDS, copySpans, pasteCheck, pasteOnto, useSpanClipboard } from '@/store/spanClipboard'

const button = 'rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40'

/** Copy the selected spans. */
export function CopyButton({ spanIds }: { spanIds: string[] }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={button}
      title={spanIds.length > 1 ? `Copy these ${spanIds.length} spans (Ctrl/⌘+C), to paste onto ${spanIds.length} others in order` : 'Copy this span (Ctrl/⌘+C), to paste its label and type onto others'}
      onClick={() => {
        if (!copySpans(spanIds)) return
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'Copied' : spanIds.length > 1 ? `Copy ${spanIds.length}` : 'Copy'}
    </button>
  )
}

/** Paste onto the selection, with the menu of what to paste. */
export function PasteButton({ spanIds }: { spanIds: string[] }) {
  const copied = useSpanClipboard((s) => s.copied)
  const fields = useSpanClipboard((s) => s.fields)
  const setFields = useSpanClipboard((s) => s.setFields)
  // Subscribing to `copied` re-renders this when the clipboard changes.
  const check = copied.length ? pasteCheck(spanIds) : { ok: false, reason: 'Copy a span first (Ctrl/⌘+C).' }
  const from =
    copied.length > 1 ? `${copied.length} spans` : copied.length ? `“${copied[0].span.label || copied[0].span.type || 'the copied span'}”` : null
  const names = PASTE_FIELDS.filter((f) => fields.includes(f.id)).map((f) => f.name.toLowerCase())
  return (
    <span className="inline-flex">
      <button
        className={`${button} rounded-r-none`}
        disabled={!check.ok || !fields.length}
        onClick={() => pasteOnto(spanIds)}
        title={check.reason ?? `Paste ${names.join(', ') || 'nothing'} from ${from} (Ctrl/⌘+V)`}
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
            {from ? `Copied: ${from}.` : 'Nothing copied yet.'} Ctrl/⌘+C copies the selected spans; Ctrl/⌘+V pastes
            these. Several copied spans paste onto as many, in time order.
          </p>
        </PopoverContent>
      </Popover>
    </span>
  )
}

/** Why Paste can't go ahead here, under the buttons, when something is copied but doesn't fit. */
export function PasteHint({ spanIds }: { spanIds: string[] }) {
  const copied = useSpanClipboard((s) => s.copied)
  if (copied.length < 2) return null
  const { reason } = pasteCheck(spanIds)
  return reason ? <p className="text-[11px] text-muted-foreground">{reason}</p> : null
}
