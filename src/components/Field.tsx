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
 */

import * as React from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

export function Field({
  label,
  helper,
  tooltip,
  children,
}: {
  label: string
  helper?: string
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="inline-flex rounded text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Info className="h-3 w-3" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
      {helper && <p className="mt-0.5 text-[10px] text-muted-foreground">{helper}</p>}
    </div>
  )
}
