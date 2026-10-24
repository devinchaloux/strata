/**
 * Fill patterns: a faint texture over a span's fill (Span.fillPattern), drawn
 * in a darker shade of the fill so it stays tone-on-tone and muted. A second
 * cue besides colour, for colour-blind readers or a figure printed in grey.
 * docs/decisions.md, "Fill Patterns".
 */
import type { FillPattern } from '@/types/strata'

export const FILL_PATTERNS: { id: FillPattern; name: string }[] = [
  { id: 'hatch', name: 'Hatch' },
  { id: 'cross', name: 'Cross-hatch' },
  { id: 'dots', name: 'Dots' },
  { id: 'lines', name: 'Lines' },
]

const isPattern = (p: unknown): p is FillPattern => FILL_PATTERNS.some((x) => x.id === p)

/** The tile size, in px, each pattern repeats at. */
export const PATTERN_TILE = 7

/** One tile of a pattern: SVG path data for its marks, and whether they are dots (filled) or lines (stroked). */
export function patternMarks(pattern: unknown): { d: string; dots: boolean } | null {
  if (!isPattern(pattern)) return null
  const t = PATTERN_TILE
  switch (pattern) {
    case 'hatch':
      return { d: `M-1 1 L1 -1 M0 ${t} L${t} 0 M${t - 1} ${t + 1} L${t + 1} ${t - 1}`, dots: false }
    case 'cross':
      return {
        d: `M-1 1 L1 -1 M0 ${t} L${t} 0 M${t - 1} ${t + 1} L${t + 1} ${t - 1} M-1 ${t - 1} L1 ${t + 1} M0 0 L${t} ${t} M${t - 1} -1 L${t + 1} 1`,
        dots: false,
      }
    case 'dots': {
      const r = 0.9
      const dot = (x: number, y: number) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`
      return { d: `${dot(t / 4, t / 4)} ${dot((3 * t) / 4, (3 * t) / 4)}`, dots: true }
    }
    case 'lines':
      return { d: `M0 ${t / 2} L${t} ${t / 2}`, dots: false }
  }
}

/**
 * The marks' colour: the fill darkened by about 40%, so the texture reads on
 * any fill without shouting. No colour (white, "none", unreadable) gets the
 * diagram's faint ink.
 */
export function patternInk(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill.trim())
  if (!m) return '#94a3b8'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
  if (r > 245 && g > 245 && b > 245) return '#94a3b8'
  const dark = (c: number) => Math.round(c * 0.6)
  return `#${[r, g, b].map((c) => dark(c).toString(16).padStart(2, '0')).join('')}`
}
