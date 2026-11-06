/**
 * How wide the layer-name column is: as wide as its longest name needs, so a
 * diagram with short names gives the room to the spans. It was a fixed 176px,
 * which left most of the column empty for names like "Phrases".
 * docs/decisions.md, "Layer Names Sized to Fit".
 */

/** The collapsed rail's width. */
export const HEADER_WIDTH_RAIL = 34

// What each row holds besides the name, in px. Reading: the row's padding
// (px-2) and the column's border. Editing: also the drag grip, the hide
// button and the settings button, with the gaps between them
// (FormDiagram.tsx, SortableLayerHeaderRow).
const CHROME = { reading: 16 + 1, editing: 4 + 13 + 4 + 14 + 4 + 4 + 18 + 6 + 1 }
// A little room so a name never sits flush against the next thing.
const SLACK = 6
// Never narrower than this, so a column of one-letter names still reads as a
// column; never wider, so one long name can't take the diagram's width.
const BOUNDS = { reading: { min: 64, max: 220 }, editing: { min: 112, max: 260 } }

/**
 * The column's width for these names. `measure` gives a name's width in px at
 * the column's type (a canvas's measureText in the app; a stub in tests).
 */
export function layerHeaderWidth(labels: string[], measure: (text: string) => number, mode: 'reading' | 'editing'): number {
  const longest = labels.reduce((w, l) => Math.max(w, measure(l)), 0)
  const { min, max } = BOUNDS[mode]
  return Math.round(Math.min(max, Math.max(min, Math.ceil(longest) + CHROME[mode] + SLACK)))
}

let canvas: HTMLCanvasElement | null = null
/**
 * A name's width at the column's type: 12px (text-xs) Inter, at the active
 * row's weight of 500, so the active name never needs more than was measured.
 */
export function measureLabel(text: string): number {
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return text.length * 7
  ctx.font = "500 12px Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
  return ctx.measureText(text).width
}
