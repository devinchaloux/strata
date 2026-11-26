/**
 * The Inspector's Hypermeter row: the span's place in a hypermetric group,
 * typed as analysts write it ("4", or "4=1" for an elided hyperbeat), and
 * whether this span shows it on the diagram (docs/decisions.md, "The
 * Hypermeter Is Its Own Field"). Kept apart from the annotation, which it
 * never touches. Text that isn't a hypermeter is put back when the field is
 * left; an empty field clears it.
 */
import { useEffect, useRef } from 'react'
import { Field } from '@/components/Field'
import { hypermeterText, parseHypermeter } from '@/lib/hypermeter'
import type { Hypermeter, Span } from '@/types/strata'

export const MIXED_VALUE = 'mixed' as const

export function HypermeterField({
  value,
  shown,
  onChange,
  inputClass,
}: {
  /** The common hypermeter, or 'mixed' when the selected spans differ. */
  value: Hypermeter | null | typeof MIXED_VALUE
  /** Whether it is drawn (the span's choice, else its layer's), or 'mixed'. */
  shown: boolean | typeof MIXED_VALUE
  onChange: (patch: Pick<Span, 'hypermeter'> | Pick<Span, 'showHypermeter'>) => void
  inputClass: string
}) {
  const text = value === MIXED_VALUE ? '' : hypermeterText(value)
  const show = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (show.current) show.current.indeterminate = shown === MIXED_VALUE
  }, [shown])

  const commit = (input: HTMLInputElement) => {
    const typed = input.value.trim()
    if (!typed) {
      if (value !== null) onChange({ hypermeter: null })
      return
    }
    const h = parseHypermeter(typed)
    if (h && hypermeterText(h) !== text) onChange({ hypermeter: h })
    else input.value = text
  }

  return (
    <Field label="Hypermeter" tooltip="Its place in a hypermetric group, drawn centered in the shape. Type 4, or 4=1 for an elided one.">
      <div className="flex items-center gap-2">
        <input
          key={value === MIXED_VALUE ? MIXED_VALUE : text}
          aria-label="Hypermeter"
          className={`${inputClass} w-20 tabular-nums`}
          defaultValue={text}
          placeholder={value === MIXED_VALUE ? 'Mixed' : ''}
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Show it on the diagram for this span, whatever the layer's setting">
          <input
            ref={show}
            type="checkbox"
            checked={shown === true}
            onChange={(e) => onChange({ showHypermeter: e.target.checked })}
          />
          Show
        </label>
      </div>
    </Field>
  )
}
