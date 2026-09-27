/**
 * Reading a document into the app — the one gate every document passes
 * through, whether it comes from Open, the demo, or crash recovery.
 *
 * Three jobs, in order:
 *   1. Identify. Refuse anything that isn't a .strata document at all.
 *   2. Validate what the app cannot work around (a span with no times, a layer
 *      that isn't an object) and refuse with a message naming the exact place.
 *   3. Normalize what it can: fill in every field the app assumes exists but an
 *      older or hand-written file may lack. `vocabulary.modes`, for example,
 *      arrived after version 1 files were already being written, and its
 *      absence used to crash Document Settings.
 *
 * Problems that don't stop the file opening — overlapping spans in a layer, a
 * widget type this version doesn't draw, a file from a newer format version —
 * come back as `notices` for the UI to show. Nothing is silently dropped: a
 * layer the app can't draw is kept in the document and saved back unchanged.
 */

import type { StrataDocument, Layer, Span, FormDiagramData } from '@/types/strata'
import { findOverlaps } from '@/lib/spanEdit'
import { formatTime } from '@/lib/youtube'

/** The newest file format this build understands. */
export const SUPPORTED_FILE_FORMAT_VERSION = 1

/** A file that cannot be opened. The message is written for the analyst. */
export class DocumentError extends Error {}

export interface LoadResult {
  doc: StrataDocument
  notices: string[]
}

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

export function readDocument(input: unknown): LoadResult {
  // ── 1. Identify ──
  if (!isObj(input)) throw new DocumentError('This file is not a Strata analysis.')
  if (
    typeof input.strataVersion !== 'string' ||
    typeof input.fileFormatVersion !== 'number' ||
    typeof input.title !== 'string' ||
    !Array.isArray(input.layers)
  ) {
    throw new DocumentError(
      'This file is missing required fields (strataVersion, fileFormatVersion, title, layers), so it is probably not a Strata analysis.',
    )
  }

  const notices: string[] = []
  if (input.fileFormatVersion > SUPPORTED_FILE_FORMAT_VERSION) {
    notices.push(
      `This file was written by a newer version of Strata (format ${input.fileFormatVersion}). ` +
        'Anything this version does not understand may not display, and saving from here may lose it.',
    )
  }

  // ── 2 & 3. Validate and normalize, layer by layer ──
  const spanIds = new Set<string>()
  const layers = input.layers.map((raw, i) => readLayer(raw, i, spanIds, notices))
  const lastSpanEnd = Math.max(
    0,
    ...layers.flatMap((l) => (l.type === 'form-diagram' ? l.data.spans.map((s) => s.endTime) : [])),
  )

  const now = new Date().toISOString()
  const vocab = isObj(input.vocabulary) ? input.vocabulary : {}
  const source = isObj(input.source) ? input.source : {}

  const doc = {
    ...input,
    createdAt: str(input.createdAt, now),
    updatedAt: str(input.updatedAt, now),
    artist: Array.isArray(input.artist)
      ? input.artist.filter((a): a is string => typeof a === 'string')
      : typeof input.artist === 'string'
        ? [input.artist]
        : [],
    duration: isNum(input.duration) && input.duration > 0 ? input.duration : lastSpanEnd,
    source: {
      ...source,
      type: source.type === 'local' ? 'local' : 'youtube',
      sourceOffset: isNum(source.sourceOffset) ? source.sourceOffset : 0,
    },
    vocabulary: {
      ...vocab,
      spanTypes: Array.isArray(vocab.spanTypes) ? vocab.spanTypes : [],
      pointMarkerTypes: Array.isArray(vocab.pointMarkerTypes) ? vocab.pointMarkerTypes : [],
      modes: Array.isArray(vocab.modes) ? vocab.modes : [],
    },
    sharedTimePoints: Array.isArray(input.sharedTimePoints) ? input.sharedTimePoints : [],
    pointMarkers: readPointMarkers(input.pointMarkers),
    layers,
  } as StrataDocument

  return { doc, notices }
}

function readLayer(raw: unknown, index: number, spanIds: Set<string>, notices: string[]): Layer {
  const where = `Layer ${index + 1}`
  if (!isObj(raw)) throw new DocumentError(`${where} is not a layer object.`)
  if (typeof raw.id !== 'string') throw new DocumentError(`${where} has no id.`)
  const label = str(raw.label, `Layer ${index + 1}`)

  const base = {
    ...raw,
    label,
    visibility: typeof raw.visibility === 'boolean' ? raw.visibility : true,
    locked: typeof raw.locked === 'boolean' ? raw.locked : false,
    fillColorDefault: str(raw.fillColorDefault, '#ffffff'),
    strokeColorDefault: str(raw.strokeColorDefault, '#475569'),
    displayOrder: isNum(raw.displayOrder) ? raw.displayOrder : index,
  }

  if (raw.type !== 'form-diagram') {
    // Kept verbatim so saving round-trips it; FormDiagram only draws its own type.
    notices.push(
      `"${label}" is a ${String(raw.type)} layer, which this version of Strata can't display yet. It is kept in the file unchanged.`,
    )
    return base as unknown as Layer
  }

  const data = isObj(raw.data) ? raw.data : {}
  const rawSpans = Array.isArray(data.spans) ? data.spans : []
  const spans = rawSpans
    .map((s, j) => readSpan(s, `"${label}", span ${j + 1}`, spanIds))
    .sort((a, b) => a.startTime - b.startTime)

  const overlaps = findOverlaps(spans)
  if (overlaps.length > 0) {
    const byId = new Map(spans.map((s) => [s.id, s]))
    const [a, b] = overlaps[0].map((id) => byId.get(id)!)
    notices.push(
      `"${label}" has ${overlaps.length === 1 ? 'two spans that overlap' : `${overlaps.length} overlapping pairs of spans`}` +
        ` (first at ${formatTime(b.startTime)}–${formatTime(a.endTime)}). Spans within one layer shouldn't overlap: ` +
        'they draw on top of each other. Move a boundary or put one of them on its own layer.',
    )
  }

  const formData: FormDiagramData = {
    ...data,
    hierarchicalEnforcement: data.hierarchicalEnforcement === true,
    spans,
  }
  return { ...base, type: 'form-diagram', data: formData } as Layer
}

function readSpan(raw: unknown, where: string, spanIds: Set<string>): Span {
  if (!isObj(raw)) throw new DocumentError(`${where} is not a span object.`)
  if (typeof raw.id !== 'string' || raw.id === '') throw new DocumentError(`${where} has no id.`)
  if (spanIds.has(raw.id)) throw new DocumentError(`${where} reuses the id "${raw.id}", which another span already has.`)
  spanIds.add(raw.id)
  if (!isNum(raw.startTime) || !isNum(raw.endTime)) {
    throw new DocumentError(`${where} is missing its start or end time.`)
  }
  if (raw.endTime <= raw.startTime) {
    throw new DocumentError(`${where} ends (${raw.endTime}s) at or before it starts (${raw.startTime}s).`)
  }
  return raw as unknown as Span
}

function readPointMarkers(raw: unknown): StrataDocument['pointMarkers'] {
  if (!Array.isArray(raw)) return []
  return raw.map((m, i) => {
    if (!isObj(m) || typeof m.id !== 'string' || !isNum(m.timestamp)) {
      throw new DocumentError(`Point marker ${i + 1} is missing its id or timestamp.`)
    }
    return m as unknown as StrataDocument['pointMarkers'][number]
  })
}
