/**
 * ColorPicker — curated swatch popover for per-span fill/stroke overrides.
 *
 * Palette from visual-design-spec.md §6: 10 hue families × 2 shades (deep/bright)
 * = 20 swatches. Organized as a 10-column × 2-row grid so family pairs are
 * visually aligned vertically. Hex input fallback for arbitrary colors.
 *
 * Three special states:
 *  - null        → inherit from layer default ("Use layer default" / nullLabel)
 *  - "none"      → explicitly no color (no fill / no stroke)
 *  - "#rrggbb"   → a specific color override
 */

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '@/lib/utils'

// Palette: 10 hue families, each with a print-safe deep/bright pair.
const PALETTE = [
  { label: 'green',   deep: '#166534', bright: '#22c55e' },
  { label: 'blue',    deep: '#1e40af', bright: '#3b82f6' },
  { label: 'cyan',    deep: '#0e7490', bright: '#06b6d4' },
  { label: 'violet',  deep: '#6d28d9', bright: '#8b5cf6' },
  { label: 'teal',    deep: '#0f766e', bright: '#14b8a6' },
  { label: 'magenta', deep: '#be185d', bright: '#ec4899' },
  { label: 'orange',  deep: '#c2410c', bright: '#f97316' },
  { label: 'amber',   deep: '#b45309', bright: '#f59e0b' },
  { label: 'red',     deep: '#991b1b', bright: '#dc2626' },
  { label: 'slate',   deep: '#475569', bright: '#94a3b8' },
  { label: 'neutral', deep: '#000000', bright: '#ffffff' },
]

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

/** Small SVG icon for the "no color" state: white box with a red diagonal slash. */
function NoneIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 14 14"
      className={cn('shrink-0 rounded-sm border', className)}
      style={{ background: 'white', borderColor: 'rgba(0,0,0,0.15)', ...style }}
      aria-hidden
    >
      <line x1="1" y1="13" x2="13" y2="1" stroke="#dc2626" strokeWidth="1.5" />
    </svg>
  )
}

export interface ColorPickerProps {
  /** Per-span override. null = inherit from layer default. "none" = explicitly no color. */
  value: string | null | undefined
  /** Layer default color; always a valid hex. Shown in trigger and reset button preview. */
  fallback: string
  onChange: (color: string | null) => void
  /** Label for the null/reset action. Defaults to "Use layer default". */
  nullLabel?: string
}

export function ColorPicker({ value, fallback, onChange, nullLabel }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState('')

  const isNone = value === 'none'
  const inheriting = value == null
  const effectiveColor = (isNone || inheriting) ? fallback : (value ?? fallback)

  function handleOpenChange(next: boolean) {
    if (next) setHexInput(isNone || inheriting ? '' : (value ?? ''))
    setOpen(next)
  }

  function pick(color: string) {
    onChange(color)
    setOpen(false)
  }

  function pickNone() {
    onChange('none')
    setOpen(false)
  }

  function reset() {
    onChange(null)
    setOpen(false)
  }

  function handleHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    const full = `#${raw}`
    setHexInput(full)
    if (raw.length === 6) onChange(full)
  }

  function handleHexKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (isValidHex(hexInput)) setOpen(false)
      else setHexInput('')
    }
    if (e.key === 'Escape') {
      setHexInput('')
      setOpen(false)
    }
  }

  function handleHexBlur() {
    if (!isValidHex(hexInput)) setHexInput(isNone || inheriting ? '' : (value ?? ''))
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex h-7 w-full items-center gap-1.5 rounded border px-2 text-[11px] hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring"
          style={{
            borderColor: 'hsl(var(--border))',
            borderStyle: inheriting ? 'dashed' : 'solid',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          {isNone ? (
            <NoneIcon className="h-3.5 w-3.5" />
          ) : (
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-sm border"
              style={{
                backgroundColor: effectiveColor,
                borderColor: 'rgba(0,0,0,0.15)',
                opacity: inheriting ? 0.55 : 1,
              }}
            />
          )}
          <span className="truncate font-mono">
            {inheriting ? 'Default' : isNone ? 'None' : (value ?? '')}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-60 p-3" align="start" sideOffset={4}>
        {/* Swatches — deep row then bright row; same family aligns in each column */}
        <div className="mb-3 grid grid-cols-11 gap-1">
          {PALETTE.map(({ label, deep }) => (
            <Swatch
              key={`${label}-d`}
              color={deep}
              title={`${label} (deep)`}
              selected={value === deep}
              onPick={pick}
            />
          ))}
          {PALETTE.map(({ label, bright }) => (
            <Swatch
              key={`${label}-b`}
              color={bright}
              title={`${label} (bright)`}
              selected={value === bright}
              onPick={pick}
            />
          ))}
        </div>

        {/* Hex input + live preview */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="shrink-0 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
            #
          </span>
          <input
            className="h-6 flex-1 rounded border px-1.5 font-mono text-[11px] outline-none focus:ring-1 focus:ring-ring"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            placeholder="rrggbb"
            value={hexInput.replace(/^#/, '')}
            onChange={handleHexChange}
            onBlur={handleHexBlur}
            onKeyDown={handleHexKeyDown}
          />
          <span
            className="h-5 w-5 shrink-0 rounded-sm border"
            style={{
              backgroundColor: isValidHex(hexInput) ? hexInput : 'transparent',
              borderColor: 'hsl(var(--border))',
            }}
          />
        </div>

        {/* No color */}
        <button
          onClick={pickNone}
          className="mb-1 flex w-full items-center gap-1.5 rounded border px-2 py-1 text-[11px] hover:bg-accent"
          style={{
            borderColor: isNone ? 'hsl(var(--ring))' : 'hsl(var(--border))',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <NoneIcon className="h-3.5 w-3.5" />
          No color
        </button>

        {/* Reset to null (inherit / layer default) */}
        <button
          onClick={reset}
          disabled={inheriting}
          className="flex w-full items-center gap-1.5 rounded border px-2 py-1 text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: 'hsl(var(--border))',
            borderStyle: 'dashed',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-sm border"
            style={{ backgroundColor: fallback, borderColor: 'rgba(0,0,0,0.15)', opacity: 0.5 }}
          />
          {nullLabel ?? 'Use layer default'}
        </button>
      </PopoverContent>
    </Popover>
  )
}

function Swatch({
  color,
  title,
  selected,
  onPick,
}: {
  color: string
  title: string
  selected: boolean
  onPick: (color: string) => void
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={() => onPick(color)}
      className={cn(
        'h-[18px] w-full rounded-sm transition-transform hover:scale-110 focus:outline-none focus:ring-1 focus:ring-ring',
        selected && 'ring-2 ring-offset-1 ring-ring',
      )}
      style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }}
    />
  )
}
