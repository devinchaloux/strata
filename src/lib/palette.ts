/**
 * The span colour palette: hue families, each in three shades. Muted is the
 * one offered first (Quick pick's fills, the picker's top row): soft tints
 * with well-separated hues, which read as categories in a figure without
 * fighting the brackets and labels, and keep the ink-coloured text on them at
 * 4.5:1 or better. Deep and bright stay for emphasis. docs/decisions.md,
 * "Muted Fills; Same Label, Same Fill; Legible Text on Any Fill".
 */
export const PALETTE: { label: string; muted: string; deep: string; bright: string }[] = [
  { label: 'green',   muted: '#9cc69b', deep: '#166534', bright: '#22c55e' },
  { label: 'blue',    muted: '#94b4dc', deep: '#1e40af', bright: '#3b82f6' },
  { label: 'cyan',    muted: '#8fcbd8', deep: '#0e7490', bright: '#06b6d4' },
  { label: 'violet',  muted: '#b3a6d9', deep: '#6d28d9', bright: '#7c3aed' },
  { label: 'teal',    muted: '#8cc6bd', deep: '#0f766e', bright: '#14b8a6' },
  { label: 'magenta', muted: '#d9a3c2', deep: '#be185d', bright: '#ec4899' },
  { label: 'orange',  muted: '#e8b08a', deep: '#c2410c', bright: '#f97316' },
  { label: 'amber',   muted: '#e3c98a', deep: '#b45309', bright: '#f59e0b' },
  { label: 'red',     muted: '#dc9a96', deep: '#991b1b', bright: '#dc2626' },
  { label: 'slate',   muted: '#b8c2cf', deep: '#475569', bright: '#94a3b8' },
  { label: 'neutral', muted: '#e7e5e4', deep: '#000000', bright: '#ffffff' },
]

const muted = (label: string) => PALETTE.find((p) => p.label === label)!.muted

/** Quick pick's eight fills: muted, one per clearly different hue, around the wheel. */
export const QUICK_FILLS = ['blue', 'teal', 'green', 'amber', 'red', 'magenta', 'violet', 'slate'].map(muted)
