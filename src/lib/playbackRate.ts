/**
 * Playback speed (docs/decisions.md, "Speed and Delay in One Settings Menu"):
 * a few presets and a custom speed for microtiming. How slow a custom speed
 * may go depends on the source: YouTube's player takes 0.25× at the slowest,
 * an audio file goes much slower.
 */
export const PRESET_RATES = [0.25, 0.5, 0.75, 1, 1.25] as const

export type SourceKind = 'youtube' | 'local'

/** The custom speed's range for a source, and its step. */
export function rateRange(kind: SourceKind): { min: number; max: number; step: number } {
  return kind === 'local' ? { min: 0.1, max: 2, step: 0.05 } : { min: 0.25, max: 2, step: 0.05 }
}

/** A speed inside the source's range, to two decimals; 1 for anything unreadable. */
export function clampRate(rate: number, kind: SourceKind): number {
  if (!Number.isFinite(rate) || rate <= 0) return 1
  const { min, max } = rateRange(kind)
  return Math.min(max, Math.max(min, Math.round(rate * 100) / 100))
}

/** "1×", "0.5×", "0.35×". */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100) / 100}×`
}

/**
 * The next speed up or down for Shift+> and Shift+<, as YouTube's player
 * steps: by 0.25× from 0.25× to 2×, and on an audio file one step further
 * down, to its slowest. A custom speed steps to the nearest one past it.
 */
export function stepRate(rate: number, direction: 1 | -1, kind: SourceKind): number {
  const { min, max } = rateRange(kind)
  const ladder = [...(min < 0.25 ? [min] : []), 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].filter((r) => r <= max)
  const next = direction > 0 ? ladder.find((r) => r > rate + 0.001) : [...ladder].reverse().find((r) => r < rate - 0.001)
  return next ?? rate
}
