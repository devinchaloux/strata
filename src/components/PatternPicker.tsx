/**
 * PatternPicker — None plus the four fill patterns (lib/patterns.ts), each a
 * small swatch drawn on the span's own fill, for the Inspector's Shape &
 * color tab. `value` null means the selection is mixed.
 */
import { FILL_PATTERNS, PATTERN_TILE, patternInk, patternMarks } from '@/lib/patterns'
import type { FillPattern } from '@/types/strata'

/** One pattern drawn on a fill, as a small swatch (also Quick pick's). */
export function PatternSwatch({ pattern, fill }: { pattern?: FillPattern; fill: string }) {
  const marks = patternMarks(pattern)
  const ink = patternInk(fill)
  const id = `pattern-swatch-${pattern ?? 'none'}-${fill.replace(/[^0-9a-z]/gi, '')}`
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden>
      {marks && (
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width={PATTERN_TILE} height={PATTERN_TILE}>
            <path d={marks.d} fill={marks.dots ? ink : 'none'} stroke={marks.dots ? 'none' : ink} strokeWidth={0.9} opacity={0.7} />
          </pattern>
        </defs>
      )}
      <rect x="0.5" y="0.5" width="27" height="15" rx="2" fill={fill === 'none' ? '#ffffff' : fill} stroke="#cbd5e1" />
      {marks && <rect x="1" y="1" width="26" height="14" rx="2" fill={`url(#${id})`} />}
    </svg>
  )
}

export function PatternPicker({
  value,
  fill,
  onChange,
}: {
  value: FillPattern | undefined | null
  fill: string
  onChange: (pattern: FillPattern | undefined) => void
}) {
  const options: { id?: FillPattern; name: string }[] = [{ name: 'None' }, ...FILL_PATTERNS]
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Fill pattern">
      {options.map((o) => {
        const on = value !== null && value === o.id
        return (
          <button
            key={o.name}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.name}
            title={o.name}
            onClick={() => onChange(o.id)}
            className={`rounded-md p-1 hover:bg-accent ${on ? 'ring-2 ring-foreground' : 'ring-1 ring-border'}`}
          >
            <PatternSwatch pattern={o.id} fill={fill} />
          </button>
        )
      })}
    </div>
  )
}
