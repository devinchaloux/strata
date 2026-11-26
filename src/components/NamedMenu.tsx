/**
 * NamedMenu — a menu whose rows are names (docs/decisions.md, "Menus Are
 * Names"): each row a name, with its keyboard shortcut on the right; one hint
 * line at the foot follows the row under the pointer or keyboard focus and
 * says what it does, or, for a row that can't act yet, what to do first. A row
 * closes the menu and acts. Used by the app bar's File and Help menus.
 */
import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface NamedMenuItem {
  name: string
  /** What the row does, in one short sentence, for the hint line. */
  hint: string
  shortcut?: string
  /** Why the row can't act yet, as what to do first; the row stays, greyed. */
  reason?: string | false
  /** A line above this row. */
  separator?: boolean
  onSelect: () => void
}

export function NamedMenu({
  trigger,
  items,
  align = 'start',
  rest,
}: {
  /** The button that opens the menu (rendered as the popover's trigger). */
  trigger: ReactNode
  items: NamedMenuItem[]
  align?: 'start' | 'end'
  /** The hint line with nothing highlighted. */
  rest?: string
}) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setHint(null)
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={6} className="w-60 p-1.5" onMouseLeave={() => setHint(null)}>
        <div className="flex flex-col" role="menu">
          {items.map((item) => (
            <div key={item.name}>
              {item.separator && <div className="my-1 border-t border-border" />}
              <button
                type="button"
                role="menuitem"
                aria-disabled={!!item.reason || undefined}
                onMouseEnter={() => setHint(item.reason || item.hint)}
                onFocus={() => setHint(item.reason || item.hint)}
                onClick={() => {
                  if (item.reason) return setHint(item.reason)
                  setOpen(false)
                  setHint(null)
                  item.onSelect()
                }}
                className={`flex w-full items-center gap-3 rounded px-2.5 py-1.5 text-left text-[13px] focus-visible:outline-hidden ${
                  item.reason ? 'cursor-default text-muted-foreground/60' : 'text-foreground hover:bg-accent focus-visible:bg-accent'
                }`}
              >
                <span>{item.name}</span>
                {item.shortcut && <kbd className="ml-auto font-sans text-[11px] text-muted-foreground">{item.shortcut}</kbd>}
              </button>
            </div>
          ))}
          <p
            className="-mx-1.5 -mb-1.5 mt-1 min-h-[2rem] rounded-b-md border-t border-border bg-(--guide-faint) px-3 py-2 text-[12px] leading-snug text-muted-foreground"
            aria-live="polite"
          >
            {hint ?? rest ?? ' '}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
