/**
 * Small accessors over the layer union. A layer's data depends on its widget
 * type, so code that only cares about spans goes through here rather than
 * casting.
 */
import type { Layer, Span, StrataDocument, WrittenAnalysisLayer } from '@/types/strata'

/** A form-diagram layer's spans; an empty list for any other widget type. */
export function formSpans(layer: Layer): Span[] {
  return layer.type === 'form-diagram' ? layer.data.spans : []
}

/** The document's written-analysis layers. */
export function analysisLayers(doc: StrataDocument): WrittenAnalysisLayer[] {
  return doc.layers.filter((l): l is WrittenAnalysisLayer => l.type === 'written-analysis')
}
