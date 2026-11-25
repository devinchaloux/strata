/**
 * Small accessors over the layer union. A layer's data depends on its widget
 * type, so code that only cares about spans goes through here rather than
 * casting.
 */
import type { Layer, Span, StrataDocument, WrittenAnalysisLayer } from '@/types/strata'

/** A segmentation layer's spans; an empty list for any other widget type. */
export function segmentSpans(layer: Layer): Span[] {
  return layer.type === 'segmentation' ? layer.data.spans : []
}

/** The document's written-analysis layers. */
export function analysisLayers(doc: StrataDocument): WrittenAnalysisLayer[] {
  return doc.layers.filter((l): l is WrittenAnalysisLayer => l.type === 'written-analysis')
}

/** The layer a quick setup fills: the active one if it's an empty form layer, else the top empty one. */
export function quickSetupLayer(doc: StrataDocument, activeId: string | null): Layer | null {
  const empty = doc.layers
    .filter((l) => l.type === 'segmentation' && segmentSpans(l).length === 0)
    .sort((a, b) => b.displayOrder - a.displayOrder)
  return empty.find((l) => l.id === activeId) ?? empty[0] ?? null
}

/**
 * A new, empty form layer. White fill (reads as no fill on the canvas) and a
 * neutral ink stroke, never a grey box (docs/decisions.md, layer colour
 * defaults).
 */
export function newSegmentLayer(label: string, displayOrder: number): Layer {
  return {
    id: crypto.randomUUID(),
    type: 'segmentation',
    label,
    visibility: true,
    locked: false,
    fillColorDefault: '#ffffff',
    strokeColorDefault: '#475569',
    displayOrder,
    data: { spans: [] },
  }
}

/**
 * The document as the reading view shows it: the layers the reader hid there
 * (uiStore.readingHiddenLayers) drawn as hidden. Only for drawing and the
 * readout; the file itself is never changed.
 */
export function withReadingHidden(doc: StrataDocument, hiddenIds: string[]): StrataDocument {
  if (hiddenIds.length === 0) return doc
  const hidden = new Set(hiddenIds)
  return { ...doc, layers: doc.layers.map((l) => (hidden.has(l.id) ? { ...l, visibility: false } : l)) }
}
