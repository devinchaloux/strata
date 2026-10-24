/**
 * Pictures of bracket shapes, for the Inspector's shape picker and the Shapes
 * quick pick (QuickEntryBar). Paths are in a 40×22 box, the bracket's top
 * line along y = 2.
 */
import type { CapStyle } from '@/types/strata'

// One end of a bracket in the shape picker: a dashed line marks the boundary,
// so an elided end visibly reaches past it.
// An elided end also draws its neighbour (faint), so the overlap shows.
export const CAP_ICONS: Record<'start' | 'end', { cap: CapStyle; name: string; bx: number; d: string; n?: string }[]> = {
  start: [
    { cap: 'rounded', name: 'Rounded', bx: 8, d: 'M 8 22 L 8 12 A 10 10 0 0 1 18 2 L 40 2' },
    { cap: 'square', name: 'Square', bx: 8, d: 'M 8 22 L 8 2 L 40 2' },
    { cap: 'angled', name: 'Angled', bx: 8, d: 'M 8 22 L 16 2 L 40 2' },
    { cap: 'open', name: 'Open', bx: 8, d: 'M 8 2 L 40 2' },
    { cap: 'elision', name: 'Elided', bx: 14, d: 'M 4 22 L 4 12 A 10 10 0 0 1 14 2 L 40 2', n: 'M 0 6 L 6 6 A 8 8 0 0 1 14 14 L 14 22' },
  ],
  end: [
    { cap: 'rounded', name: 'Rounded', bx: 32, d: 'M 0 2 L 22 2 A 10 10 0 0 1 32 12 L 32 22' },
    { cap: 'square', name: 'Square', bx: 32, d: 'M 0 2 L 32 2 L 32 22' },
    { cap: 'angled', name: 'Angled', bx: 32, d: 'M 0 2 L 24 2 L 32 22' },
    { cap: 'open', name: 'Open', bx: 32, d: 'M 0 2 L 32 2' },
    { cap: 'elision', name: 'Elided', bx: 26, d: 'M 0 2 L 26 2 A 10 10 0 0 1 36 12 L 36 22', n: 'M 26 22 L 26 14 A 8 8 0 0 1 34 6 L 40 6' },
  ],
}

/** Whole brackets, both ends alike. */
export const WHOLE_ICONS: { cap: CapStyle; name: string; d: string }[] = [
  { cap: 'rounded', name: 'Rounded', d: 'M 2 22 L 2 12 A 10 10 0 0 1 12 2 L 28 2 A 10 10 0 0 1 38 12 L 38 22' },
  { cap: 'square', name: 'Square', d: 'M 2 22 L 2 2 L 38 2 L 38 22' },
  { cap: 'angled', name: 'Angled', d: 'M 2 22 L 10 2 L 30 2 L 38 22' },
]
