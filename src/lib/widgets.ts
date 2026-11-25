/**
 * Widgets as blocks: the work area shows one framed block per widget type,
 * top to bottom above the shared ruler, each holding every layer of its type
 * (StrataDocument.widgets; docs/decisions.md, "Widgets as Blocks").
 *
 * Pure functions; the store's widget actions apply them.
 */
import type { BlockType, StrataDocument, WidgetBlock } from '@/types/strata'

/** What each block type is called on screen. */
export const WIDGET_NAMES: Record<BlockType, string> = {
  'segmentation': 'Segments',
  tempo: 'Tempo',
}

/**
 * The document's blocks, top to bottom: its own list with duplicates dropped,
 * the Segments block added at the bottom if missing (it is always there), and a
 * tempo block added just below the Segments block if a tempo layer needs one.
 * Entries whose type this version doesn't know are kept, so saving
 * round-trips them; callers draw only the types they know.
 */
export function widgetBlocks(doc: Pick<StrataDocument, 'widgets' | 'layers'>): WidgetBlock[] {
  const seen = new Set<string>()
  const out: WidgetBlock[] = []
  for (const w of doc.widgets ?? []) {
    if (!w || typeof w.type !== 'string' || seen.has(w.type)) continue
    seen.add(w.type)
    out.push(w)
  }
  if (!seen.has('segmentation')) out.push({ type: 'segmentation' })
  if (!seen.has('tempo') && doc.layers.some((l) => l.type === 'tempo')) {
    const at = out.findIndex((w) => w.type === 'segmentation')
    out.splice(at + 1, 0, { type: 'tempo' })
  }
  return out
}

/** The blocks with one moved a place up (-1) or down (+1); unchanged at an end. */
export function moveBlock(blocks: WidgetBlock[], type: BlockType, dir: -1 | 1): WidgetBlock[] {
  const i = blocks.findIndex((w) => w.type === type)
  const j = i + dir
  if (i < 0 || j < 0 || j >= blocks.length) return blocks
  const out = [...blocks]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** The blocks with one shown or hidden. */
export function setBlockHidden(blocks: WidgetBlock[], type: BlockType, hidden: boolean): WidgetBlock[] {
  return blocks.map((w) => {
    if (w.type !== type) return w
    if (hidden) return { ...w, hidden: true }
    const rest = { ...w }
    delete rest.hidden
    return rest
  })
}

/** Whether a block is drawn: listed and not hidden. */
export function blockShown(blocks: WidgetBlock[], type: BlockType): boolean {
  const w = blocks.find((b) => b.type === type)
  return !!w && !w.hidden
}
