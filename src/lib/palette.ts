/**
 * The span colour palette: hue families, each in three shades. Muted is the
 * one offered first (Quick pick's fills, the picker's top row): soft tints
 * with well-separated hues, which read as categories in a figure without
 * fighting the brackets and labels, and keep the ink-coloured text on them at
 * 4.5:1 or better. Deep and bright stay for emphasis. docs/decisions.md,
 * "Quick Pick Colours, and a Colour-Blind Safe Switch".
 */
export const PALETTE: { label: string; muted: string; deep: string; bright: string }[] = [
  { label: 'red',     muted: '#e8a093', deep: '#991b1b', bright: '#dc2626' },
  { label: 'orange',  muted: '#efb882', deep: '#c2410c', bright: '#f97316' },
  { label: 'yellow',  muted: '#efe08a', deep: '#a16207', bright: '#eab308' },
  { label: 'green',   muted: '#a8d08f', deep: '#166534', bright: '#22c55e' },
  { label: 'seafoam', muted: '#92d4c0', deep: '#0f766e', bright: '#2dd4bf' },
  { label: 'cyan',    muted: '#8fcbd8', deep: '#0e7490', bright: '#06b6d4' },
  { label: 'blue',    muted: '#98bce6', deep: '#1e40af', bright: '#3b82f6' },
  { label: 'violet',  muted: '#baa9e0', deep: '#6d28d9', bright: '#7c3aed' },
  { label: 'magenta', muted: '#e3a8c6', deep: '#be185d', bright: '#ec4899' },
  { label: 'slate',   muted: '#b8c2cf', deep: '#475569', bright: '#94a3b8' },
  { label: 'neutral', muted: '#cdc8c0', deep: '#000000', bright: '#ffffff' },
]

const muted = (label: string) => PALETTE.find((p) => p.label === label)!.muted

/**
 * Quick pick's eight fills: seven muted hues round the wheel and a warm grey
 * ("stone") for passages to keep quiet.
 */
export const QUICK_FILLS = ['red', 'orange', 'yellow', 'green', 'seafoam', 'blue', 'violet', 'neutral'].map(muted)

/**
 * The same eight slots in colours that stay apart for the common kinds of
 * colour blindness: lighter tints of the Okabe–Ito palette, slot for slot
 * (coral → vermilion, seafoam → sky, stone → grey …).
 */
export const SAFE_FILLS = ['#eaa47f', '#f2c47d', '#f3ea8f', '#86c9b1', '#a3d3f0', '#86abd2', '#ddaccd', '#c8c8c8']

const SAFE = new Map(QUICK_FILLS.map((c, i) => [c, SAFE_FILLS[i]]))

/**
 * How a fill is drawn with "Colour-blind safe" on: a quick fill as its safe
 * counterpart, anything else as it is. The file keeps the quick fill, so
 * turning the switch off brings it back.
 */
export function safeFill(color: string): string {
  return SAFE.get(color.toLowerCase()) ?? color
}
