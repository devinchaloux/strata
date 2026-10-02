/**
 * Field — the label + control + helper row shared by the Inspector panels and
 * Document Settings. Previously copy-pasted into MetadataPanel,
 * PointMarkerPanel, and DocumentSettingsDialog; the copies drifted (one field
 * ended up with three different helper strings), which is why they're now one.
 *
 * `helper` renders inline beneath the control and costs vertical space on every
 * render, so it earns its place only when it carries an instruction that
 * prevents an error. Detail that merely refines an already-clear label belongs
 * in `tooltip`, which occupies no layout until asked for.
 *
 * `tooltip` is hover/focus only (Radix does not open tooltips on touch), so it
 * must never be the sole route to something needed to complete a task.
 *
 * `symbols` adds the symbol palette (⇒ ♭ ♯ …) to a free-text field: a toggle
 * in the label row opens a row of buttons that insert at the cursor of the
 * field's input or textarea. The buttons never take focus, so typing carries
 * on where it was and the edit stays one undo step.
 */

import * as React from 'react'
import { Info } from 'lucide-react'
import { PALETTE_SYMBOLS, insertAt } from '@/lib/musicSymbols'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-[13px] text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

export function Field({
  label,
  helper,
  tooltip,
  symbols,
  children,
}: {
  label: string
  helper?: string
  tooltip?: string
  symbols?: boolean
  children: React.ReactNode
}) {
  const box = React.useRef<HTMLDivElement>(null)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const labelId = React.useId()
  // Name the control by its visible label, so a screen reader announces
  // "Label, edit text" rather than an unnamed field. A control that already
  // carries its own name keeps it.
  const control =
    React.isValidElement<Record<string, unknown>>(children) &&
    typeof children.type === 'string' &&
    !children.props['aria-label'] &&
    !children.props['aria-labelledby']
      ? React.cloneElement(children, { 'aria-labelledby': labelId })
      : children
  return (
    <div className="group mb-3" ref={box}>
      <div className="mb-1 flex items-center gap-1">
        <label id={labelId} className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="inline-flex rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Info className="h-3 w-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
        {symbols && (
          <button
            type="button"
            aria-label={`Insert a symbol into ${label}`}
            title="Insert a symbol"
            aria-expanded={paletteOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPaletteOpen((o) => !o)}
            className={
              'ml-auto rounded px-1 text-xs leading-4 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
              (paletteOpen ? 'bg-accent text-foreground' : 'text-muted-foreground')
            }
          >
            {/* Compact until the field is in use, so a column of fields doesn't
                repeat the words; spelled out then, and the tooltip-free label
                says what it does. */}
            {paletteOpen ? (
              'Close symbols'
            ) : (
              <>
                <span className="hidden group-focus-within:inline">Insert symbol </span>♭♯
              </>
            )}
          </button>
        )}
      </div>
      {control}
      {symbols && paletteOpen && (
        <div className="mt-1 flex flex-wrap gap-0.5" role="toolbar" aria-label="Symbols">
          {PALETTE_SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              title={`Insert ${sym}`}
              aria-label={`Insert ${sym}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertSymbol(box.current, sym)}
              className="h-6 min-w-6 rounded border border-border bg-card px-1 text-xs text-foreground hover:bg-accent"
            >
              {sym}
            </button>
          ))}
        </div>
      )}
      {helper && <p className="mt-0.5 text-[11px] text-muted-foreground">{helper}</p>}
    </div>
  )
}

/**
 * Insert `text` into the field's control at its cursor (or over its
 * selection). The value is set through the native setter and announced with an
 * input event, which is how React's onChange sees a programmatic edit.
 */
function insertSymbol(container: HTMLElement | null, text: string) {
  const el = container?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!el || el.disabled || el.readOnly) return
  const { value, caret } = insertAt(el.value, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, text)
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.focus()
  el.setSelectionRange(caret, caret)
}
