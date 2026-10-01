/**
 * MetadataPanel — the right sidebar for the selected span (Phase 0.4 §5).
 *
 * Appears when a span is selected; every control live-dispatches to the document
 * store, so edits are undo-covered (zundo) automatically. Field set and order
 * follow the 0.4 spec. Deferred within this slice: click-to-seek on the time
 * range (needs the player wired globally — slice 3), the curated color swatch
 * picker (basic color inputs for now), and Split at playhead (shares logic with
 * boundary placement — slice 3).
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useMerge } from '@/hooks/useMerge'
import { formatTime, formatClock } from '@/lib/youtube'
import { TimeInput } from './TimeInput'
import { TypePicker } from './TypePicker'
import { blockForSpan, blockForRange } from '@/widgets/written-analysis/commentary'
import { capFromBoundaryType } from '@/lib/formShape'
import { slugify } from '@/lib/slug'
import { ColorPicker } from '@/components/ui/color-picker'
import { Field, inputClass } from '@/components/Field'
import { toAccidentals } from '@/lib/musicSymbols'
import type {
  Span,
  Layer,
  FormDiagramData,
  ConfidenceLevel,
  BoundaryType,
  CapStyle,
  LineStyle,
} from '@/types/strata'

// Key area is offered in two places (leading the panel on a bar layer, tucked
// into Advanced otherwise) and again for multi-select. One string each, so the
// three can't drift apart the way they previously did.
const KEY_AREA_TIP = 'Relative to the home key.'
const KEY_AREA_PLACEHOLDER = 'e.g. vi, III'


function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded border border-border p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-1 rounded px-1.5 py-0.5 text-xs transition-colors"
            style={{
              backgroundColor: active ? 'hsl(var(--primary))' : 'transparent',
              color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export interface SpanEntry {
  layer: Layer
  span: Span
}

/** Resolve selected span ids to {layer, span} entries (order follows ids). */
function findSpans(layers: Layer[], spanIds: string[]): SpanEntry[] {
  const out: SpanEntry[] = []
  for (const id of spanIds) {
    for (const layer of layers) {
      if (layer.type !== 'form-diagram') continue
      const span = (layer.data as FormDiagramData).spans.find((s) => s.id === id)
      if (span) {
        out.push({ layer, span })
        break
      }
    }
  }
  return out
}

const CONFIDENCE_OPTS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'definite', label: 'Definite' },
  { value: 'approximate', label: 'Approx.' },
  { value: 'speculative', label: 'Spec.' },
]

// "Clean" rather than "Definite": it is the word analysts reach for when asking
// whether a boundary cuts or melds, and it stops the option list reading as a
// second Confidence control. The stored value is unchanged.
const BOUNDARY_OPTS: { value: BoundaryType; label: string }[] = [
  { value: 'definite', label: 'Clean' },
  { value: 'gradual', label: 'Gradual' },
  { value: 'elided', label: 'Elided' },
]

const CAP_OPTS: { value: CapStyle; label: string }[] = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'angled', label: 'Angled' },
  { value: 'open', label: 'Open' },
  { value: 'elision', label: 'Elision' },
]

const LINESTYLE_OPTS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
]

type EndSelect = {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  mixed?: boolean
}

/**
 * How a span's two ends look: the boundary type (the analytical claim) and the
 * cap (the drawing), one row per end. Boundary leads because choosing it sets
 * the cap; the cap column is there to diverge from it.
 */
function EndsGrid({
  start,
  end,
  showCaps,
}: {
  start: [EndSelect, EndSelect]
  end: [EndSelect, EndSelect]
  showCaps: boolean
}) {
  const head = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground'
  const select = (c: EndSelect) => (
    <select
      aria-label={c.label}
      className={inputClass}
      value={c.mixed ? '' : c.value}
      onChange={(e) => c.onChange(e.target.value)}
    >
      {c.mixed && <option value="">Mixed</option>}
      {c.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  const row = (name: string, [boundary, cap]: [EndSelect, EndSelect]) => (
    <>
      <span className="text-xs text-muted-foreground">{name}</span>
      {select(boundary)}
      {showCaps && select(cap)}
    </>
  )
  return (
    <div
      className="mb-3 grid items-center gap-x-2 gap-y-1.5"
      style={{ gridTemplateColumns: showCaps ? '2.25rem 1fr 1fr' : '2.25rem 1fr' }}
    >
      <span />
      <span className={head}>Boundary</span>
      {showCaps && <span className={head}>Cap</span>}
      {row('Start', start)}
      {row('End', end)}
    </div>
  )
}

/** A single span's ends, in the grid above. A new boundary type clears that
 *  side's cap override so the drawing follows the claim. */
function SpanEnds({
  span,
  update,
  showCaps,
}: {
  span: Span
  update: (patch: Partial<Omit<Span, 'id'>>) => void
  showCaps: boolean
}) {
  const side = (which: 'start' | 'end'): [EndSelect, EndSelect] => {
    const bt = which === 'start' ? span.startBoundaryType : span.endBoundaryType
    const cap = which === 'start' ? span.startCap : span.endCap
    return [
      {
        label: `${which === 'start' ? 'Start' : 'End'} boundary`,
        value: bt ?? 'definite',
        options: BOUNDARY_OPTS,
        onChange: (v) =>
          update(
            which === 'start'
              ? { startBoundaryType: v as BoundaryType, startCap: undefined }
              : { endBoundaryType: v as BoundaryType, endCap: undefined },
          ),
      },
      {
        label: `${which === 'start' ? 'Start' : 'End'} cap`,
        value: cap ?? capFromBoundaryType(bt),
        options: CAP_OPTS,
        onChange: (v) => update(which === 'start' ? { startCap: v as CapStyle } : { endCap: v as CapStyle }),
      },
    ]
  }
  return <EndsGrid start={side('start')} end={side('end')} showCaps={showCaps} />
}

/**
 * Which bracket sits on top where an elision makes two brackets overlap. Shown
 * only at a boundary that actually overlaps (an elision cap on either side of a
 * shared edge). The setting lives on the earlier span (`endOnTop`), so this
 * span's start writes to its previous neighbour.
 */
function OverlapFields({ layer, span }: { layer: Layer; span: Span }) {
  const updateSpan = useDocumentStore((s) => s.updateSpan)
  const spans = (layer.data as FormDiagramData).spans
  const prev = spans.find((s) => s.endTime === span.startTime && s.id !== span.id)
  const next = spans.find((s) => s.startTime === span.endTime && s.id !== span.id)
  const capAt = (s: Span, side: 'start' | 'end') =>
    side === 'start'
      ? (s.startCap ?? capFromBoundaryType(s.startBoundaryType))
      : (s.endCap ?? capFromBoundaryType(s.endBoundaryType))
  const startOverlaps = prev && (capAt(span, 'start') === 'elision' || capAt(prev, 'end') === 'elision')
  const endOverlaps = next && (capAt(span, 'end') === 'elision' || capAt(next, 'start') === 'elision')
  if (!startOverlaps && !endOverlaps) return null

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        {startOverlaps && prev && (
          <Field label="On top at start">
            <Segmented
              options={[
                { value: 'this', label: 'This' },
                { value: 'other', label: 'Previous' },
              ]}
              value={prev.endOnTop ? 'other' : 'this'}
              onChange={(v) => updateSpan(layer.id, prev.id, { endOnTop: v === 'other' || undefined })}
            />
          </Field>
        )}
      </div>
      <div className="flex-1">
        {endOverlaps && next && (
          <Field label="On top at end">
            <Segmented
              options={[
                { value: 'this', label: 'This' },
                { value: 'other', label: 'Next' },
              ]}
              value={span.endOnTop ? 'this' : 'other'}
              onChange={(v) => updateSpan(layer.id, span.id, { endOnTop: v === 'this' || undefined })}
            />
          </Field>
        )}
      </div>
    </div>
  )
}

/** Overlap order and stroke. The caps live beside the boundary types in
 *  EndsGrid, still in the open (Devin's call, 2026-07-25): picking a boundary
 *  type updates its cap in place, on the same row. */
function ShapeFields({
  layer,
  span,
  update,
}: {
  layer: Layer
  span: Span
  update: (patch: Partial<Omit<Span, 'id'>>) => void
}) {
  return (
    <>
      <OverlapFields layer={layer} span={span} />

      <Field label="Stroke">
        <Segmented
          options={LINESTYLE_OPTS}
          value={span.lineStyle ?? 'solid'}
          onChange={(v) => update({ lineStyle: v })}
        />
      </Field>
    </>
  )
}

// ---------------------------------------------------------------------------
// MetadataPanel
// ---------------------------------------------------------------------------

export function MetadataPanel() {
  const doc = useDocumentStore((s) => s.document)
  const selectedSpanIds = useUIStore((s) => s.selectedSpanIds)

  const found = findSpans(doc?.layers ?? [], selectedSpanIds)
  if (found.length === 0) return null
  if (found.length === 1) return <SingleSpanPanel layer={found[0].layer} span={found[0].span} />
  return <MultiSpanPanel entries={found} />
}

// ---------------------------------------------------------------------------
// Single-span panel — the full Phase 0.4 §5 field set for one selected span.
// ---------------------------------------------------------------------------

function SingleSpanPanel({ layer, span }: { layer: Layer; span: Span }) {
  const updateSpan = useDocumentStore((s) => s.updateSpan)
  const removeSpan = useDocumentStore((s) => s.removeSpan)
  const placeBoundary = useDocumentStore((s) => s.placeBoundary)
  const setSpanEdgeAction = useDocumentStore((s) => s.setSpanEdge)
  const setSpanLabels = useDocumentStore((s) => s.setSpanLabels)
  const regenerateSlug = useDocumentStore((s) => s.regenerateSlug)
  const setSpanCommentary = useDocumentStore((s) => s.setSpanCommentary)
  const commentary = useDocumentStore((s) => (s.document ? blockForSpan(s.document, span.id)?.text ?? '' : ''))
  // A frozen slug that no longer matches its label (the span was renamed after
  // a save). The suffix match lets "verse-2" still count as matching "Verse".
  const expectedBase = span.label ? slugify(span.label) : null
  const slugStale =
    expectedBase !== null &&
    span.slug !== null &&
    span.slug !== undefined &&
    span.slug !== expectedBase &&
    !new RegExp(`^${expectedBase}-\\d+$`).test(span.slug)
  const selectSpan = useUIStore((s) => s.selectSpan)
  // Subscribes to the yes/no answer, not the time itself, so the panel
  // re-renders when the playhead crosses into or out of the span, not per frame.
  const canSplit = useUIStore((s) => s.currentTime > span.startTime && s.currentTime < span.endTime)
  const { neighborId, performMerge } = useMerge()

  const prevId = neighborId(span.id, 'prev')
  const nextId = neighborId(span.id, 'next')

  const update = (patch: Partial<Omit<Span, 'id'>>) => updateSpan(layer.id, span.id, patch)


  // Key-area ("bar") layers lead with keyArea and tuck the bracket-only visual
  // fields (caps, stroke — meaningless on a flat bar) under "more fields".
  // Boundary type stays visible either way — it's analytical data, not a
  // visual choice, and still applies to a key area's transition character.
  const isBar = layer.spanShape === 'bar'
  const [shapeFieldsExpanded, setShapeFieldsExpanded] = useState(false)
  useEffect(() => setShapeFieldsExpanded(false), [span.id])

  function handleDelete() {
    removeSpan(layer.id, span.id)
    selectSpan(null)
  }

  function handleSplit() {
    placeBoundary(layer.id, useUIStore.getState().currentTime)
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
  }

  const duration = span.endTime - span.startTime

  // Numeric boundary edits. The store clamps them so the layer stays tiled: a
  // shared boundary moves both spans (as a drag would), and an edge facing a
  // gap stops at the gap's far side.
  function commitStart(t: number) {
    setSpanEdgeAction(layer.id, span.id, 'start', t)
  }
  function commitEnd(t: number) {
    setSpanEdgeAction(layer.id, span.id, 'end', t)
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-3">
        {/* Time range (editable) + duration */}
        <div className="mb-3 rounded bg-muted px-2 py-1.5">
          <div className="flex items-center justify-between gap-1">
            <TimeInput value={span.startTime} onCommit={commitStart} title="Start time" />
            <span className="text-muted-foreground">→</span>
            <TimeInput value={span.endTime} onCommit={commitEnd} title="End time" />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Duration {formatTime(duration)}
          </div>
        </div>

        {/* Label */}
        <Field label="Label" symbols>
          <input
            data-inspector-label
            className={inputClass}
            value={span.label ?? ''}
            placeholder="Unlabeled"
            onChange={(e) => setSpanLabels([span.id], e.target.value === '' ? null : e.target.value)}
          />
        </Field>

        {/* Short label — shown in place of the full label when the diagram is
            too zoomed out to fit it; never abbreviated further by the app. */}
        <Field label="Short label" tooltip="Shown when the full label doesn't fit." symbols>
          <input
            className={inputClass}
            value={span.shortLabel ?? ''}
            placeholder="e.g. V1"
            onChange={(e) => update({ shortLabel: e.target.value || null })}
          />
        </Field>

        {/* Key area — leads the panel on a key-area (bar) layer, since that's
            the whole point of the layer; tucked into Advanced otherwise. */}
        {isBar && (
          <Field label="Key area" tooltip={KEY_AREA_TIP}>
            <input
              className={inputClass}
              value={span.keyArea ?? ''}
              placeholder={KEY_AREA_PLACEHOLDER}
              onChange={(e) => update({ keyArea: toAccidentals(e.target.value) || null })}
            />
          </Field>
        )}

        {/* Slug (read-only, click to copy). Once saved it no longer follows
            the label (lib/slug.ts), so a rename offers an explicit regenerate. */}
        <Field
          label="Slug"
          tooltip="The name commentary links ([[its-slug]]) and embeds use for this span. It stays the same after the file is saved, so renaming the span doesn't break links to it."
        >
          <button
            className={`${inputClass} flex items-center justify-between text-left`}
            title="Click to copy"
            onClick={() => span.slug && copy(span.slug)}
            disabled={!span.slug}
          >
            <span className={span.slug ? 'text-foreground' : 'text-muted-foreground'}>
              {span.slug ?? '—'}
            </span>
            {span.slug && <span className="text-[11px] text-muted-foreground">copy</span>}
          </button>
          {slugStale && (
            <button
              className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => regenerateSlug(span.id)}
            >
              Update slug to match the label
            </button>
          )}
        </Field>

        {/* Type — picking one also names an unlabeled span after it. */}
        <Field label="Type">
          <TypePicker
            kind="span"
            value={span.type}
            onPick={(id, term) => {
              update({ type: id })
              if (term && !span.label) setSpanLabels([span.id], term.label)
            }}
          />
        </Field>

        {/* Annotation */}
        <Field label="Annotation" tooltip="Shown inside the shape on the diagram." symbols>
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={span.annotation ?? ''}
            onChange={(e) => update({ annotation: e.target.value || null })}
          />
        </Field>

        {/* Confidence */}
        <Field label="Confidence">
          <Segmented
            options={CONFIDENCE_OPTS}
            value={span.confidence ?? 'definite'}
            onChange={(v) => update({ confidence: v })}
          />
        </Field>

        {/* Ends — boundary type and cap per side. On a key-area bar the caps
            mean nothing, so they join the shape fields behind the disclosure. */}
        <SpanEnds span={span} update={update} showCaps={!isBar || shapeFieldsExpanded} />

        {/* Shape — visual caps + stroke (the analyst's drawing choice, decoupled
            from the boundary-type data above). Meaningless on a flat key-area
            bar, so tucked under "more fields" there — never removed, just
            de-emphasized (docs/decisions.md "Key-Area Bar Layers"). */}
        {isBar ? (
          <div className="mb-3">
            <button
              onClick={() => setShapeFieldsExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {shapeFieldsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              More fields (shape)
            </button>
            {shapeFieldsExpanded && (
              <div className="mt-2">
                <ShapeFields layer={layer} span={span} update={update} />
              </div>
            )}
          </div>
        ) : (
          <ShapeFields layer={layer} span={span} update={update} />
        )}

        {/* Notes */}
        <Field label="Notes" tooltip="For you; not shown on the diagram." symbols>
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={span.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value || null })}
          />
        </Field>

        {/* Written analysis: prose about this span, shown above the diagram
            while it plays. Stored in the document's commentary layer, not on
            the span, so it can outlive the span (see widgets/written-analysis). */}
        <Field
          label="Commentary"
          symbols
          tooltip="Shows above the diagram while this span plays. Link to a span or point marker with [[its-slug]]; **bold** and *italic* work."
        >
          <textarea
            className={`${inputClass} resize-y`}
            rows={5}
            value={commentary}
            placeholder="Write about this passage."
            onChange={(e) => setSpanCommentary(span.id, e.target.value)}
          />
        </Field>

        {/* Lyrics */}
        <Field label="Lyrics">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={span.lyrics ?? ''}
            onChange={(e) => update({ lyrics: e.target.value || null })}
          />
        </Field>

        {/* Advanced */}
        <div className="mt-4 mb-2 border-t pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" style={{ borderColor: 'var(--hairline)' }}>
          Advanced
        </div>

        {/* Colors */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Fill">
              <ColorPicker
                value={span.fillColor}
                fallback={layer.fillColorDefault}
                onChange={(c) => update({ fillColor: c })}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Stroke">
              <ColorPicker
                value={span.strokeColor}
                fallback={layer.strokeColorDefault}
                onChange={(c) => update({ strokeColor: c })}
              />
            </Field>
          </div>
        </div>

        {/* Key area — secondary here since this layer isn't shape-dedicated to
            it; leads the panel instead on a key-area (bar) layer, above. */}
        {!isBar && (
          <Field label="Key area" tooltip={KEY_AREA_TIP}>
            <input
              className={inputClass}
              value={span.keyArea ?? ''}
              placeholder={KEY_AREA_PLACEHOLDER}
              onChange={(e) => update({ keyArea: toAccidentals(e.target.value) || null })}
            />
          </Field>
        )}

        {/* Parent (read-only in v1) */}
        <Field label="Parent">
          <div className={`${inputClass} text-muted-foreground`}>
            {span.parentId ?? 'none'}
          </div>
        </Field>

        {/* ID (read-only, copy) */}
        <Field label="ID">
          <button
            className={`${inputClass} flex items-center justify-between text-left`}
            title="Click to copy"
            onClick={() => copy(span.id)}
          >
            <span className="truncate text-muted-foreground">{span.id}</span>
            <span className="ml-1 shrink-0 text-[11px] text-muted-foreground">copy</span>
          </button>
        </Field>

        {/* Merge with neighbor (Merge UX §3.4) */}
        <div className="mt-4 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={() => prevId && performMerge([prevId, span.id])}
            disabled={!prevId}
            title={prevId ? 'Merge with previous span' : 'No previous span in this layer'}
            className="flex-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40"
          >
            Merge ←
          </button>
          <button
            onClick={() => nextId && performMerge([span.id, nextId])}
            disabled={!nextId}
            title={nextId ? 'Merge with next span' : 'No next span in this layer'}
            className="flex-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40"
          >
            → Merge
          </button>
        </div>

        {/* Actions */}
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleSplit}
            disabled={!canSplit}
            title={canSplit ? 'Split at playhead' : 'Move the playhead inside this span to split'}
            className="flex-1 rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent disabled:opacity-40"
          >
            Split
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-span panel — bulk edit (Phase 2.5). Fields that sensibly apply across a
// selection stay editable and write to ALL selected spans in one undo step;
// per-span / positional fields (time, slug, notes, parent) are omitted. When a
// field's value differs across the selection it reads as "Mixed" until set.
// ---------------------------------------------------------------------------

const MIXED = Symbol('mixed')

/** Common value across spans for one field, or MIXED when they disagree. */
function commonValue<T>(spans: Span[], get: (s: Span) => T): T | typeof MIXED {
  const first = get(spans[0])
  return spans.every((s) => get(s) === first) ? first : MIXED
}

function MultiSpanPanel({ entries }: { entries: SpanEntry[] }) {
  const doc = useDocumentStore((s) => s.document)
  const updateSpans = useDocumentStore((s) => s.updateSpans)
  const { eligibility, performMerge } = useMerge()

  const spans = entries.map((e) => e.span)
  const ids = spans.map((s) => s.id)

  // Apply a patch to every selected span (one undo step).
  const setAll = (patch: Partial<Omit<Span, 'id'>>) => updateSpans(ids, patch)
  const setSpanLabels = useDocumentStore((s) => s.setSpanLabels)

  // Resolved common values (or MIXED) per bulk field.
  const label = commonValue(spans, (s) => s.label ?? '')
  const type = commonValue(spans, (s) => s.type ?? '')
  const annotation = commonValue(spans, (s) => s.annotation ?? '')
  const lyrics = commonValue(spans, (s) => s.lyrics ?? '')
  const keyArea = commonValue(spans, (s) => s.keyArea ?? '')
  const confidence = commonValue(spans, (s) => s.confidence ?? 'definite')
  const startB = commonValue(spans, (s) => s.startBoundaryType ?? 'definite')
  const endB = commonValue(spans, (s) => s.endBoundaryType ?? 'definite')
  const startCap = commonValue(spans, (s) => s.startCap ?? capFromBoundaryType(s.startBoundaryType))
  const endCap = commonValue(spans, (s) => s.endCap ?? capFromBoundaryType(s.endBoundaryType))
  const lineStyle = commonValue(spans, (s) => s.lineStyle ?? 'solid')

  // Layer color defaults for the swatch fallback (use the first selection's layer).
  const fillFallback = entries[0].layer.fillColorDefault
  const strokeFallback = entries[0].layer.strokeColorDefault
  const fill = commonValue(spans, (s) => s.fillColor ?? null)
  const stroke = commonValue(spans, (s) => s.strokeColor ?? null)

  const mergeReason = eligibility.ok ? '' : eligibility.reason

  // Commentary on the whole stretch the selection covers (a time-range block),
  // as opposed to the per-span commentary each span has on its own.
  const setRangeCommentary = useDocumentStore((s) => s.setRangeCommentary)
  const rangeStart = Math.min(...spans.map((s) => s.startTime))
  const rangeEnd = Math.max(...spans.map((s) => s.endTime))
  const rangeText = doc ? (blockForRange(doc, rangeStart, rangeEnd)?.text ?? '') : ''

  return (
    <div className="flex flex-col">
      <div className="px-3 py-3">
        {/* Merge — primary multi-select action */}
        <button
          onClick={() => performMerge()}
          disabled={!eligibility.ok}
          title={mergeReason}
          className="mb-4 w-full rounded bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {eligibility.ok ? `Merge ${spans.length} spans` : 'Merge'}
        </button>
        {!eligibility.ok && (
          <p className="-mt-3 mb-4 text-[11px] text-muted-foreground">{mergeReason}</p>
        )}

        <Field
          label={`Commentary, ${formatClock(rangeStart)}–${formatClock(rangeEnd)}`}
          tooltip="About the whole stretch these spans cover. Shows above the diagram while it plays."
          symbols
        >
          <textarea
            className={`${inputClass} resize-y`}
            rows={3}
            value={rangeText}
            placeholder="Write about this stretch."
            onChange={(e) => setRangeCommentary(rangeStart, rangeEnd, e.target.value)}
          />
        </Field>

        <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Apply to all selected
        </div>

        {/* Label */}
        <Field label="Label">
          <input
            className={inputClass}
            value={label === MIXED ? '' : label}
            placeholder={label === MIXED ? 'Mixed. Type to set all.' : 'Unlabeled'}
            onChange={(e) => setSpanLabels(ids, e.target.value === '' ? null : e.target.value)}
          />
        </Field>

        {/* Type — unlabeled spans take the type's label as well. */}
        <Field label="Type">
          <TypePicker
            kind="span"
            value={type === MIXED ? null : type || null}
            mixed={type === MIXED}
            onPick={(id, term) => {
              setAll({ type: id })
              const unlabeled = spans.filter((s) => !s.label).map((s) => s.id)
              if (term && unlabeled.length) setSpanLabels(unlabeled, term.label)
            }}
          />
        </Field>

        {/* Annotation */}
        <Field label="Annotation" tooltip="Shown inside the shape on the diagram.">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={annotation === MIXED ? '' : annotation}
            placeholder={annotation === MIXED ? 'Mixed. Type to set all.' : ''}
            onChange={(e) => setAll({ annotation: e.target.value || null })}
          />
        </Field>

        {/* Confidence */}
        <Field label="Confidence" helper={confidence === MIXED ? 'Mixed' : undefined}>
          <Segmented
            options={CONFIDENCE_OPTS}
            value={confidence === MIXED ? ('' as ConfidenceLevel) : confidence}
            onChange={(v) => setAll({ confidence: v })}
          />
        </Field>

        {/* Ends */}
        <EndsGrid
          showCaps
          start={[
            { label: 'Start boundary', value: startB === MIXED ? '' : startB, mixed: startB === MIXED, options: BOUNDARY_OPTS, onChange: (v) => setAll({ startBoundaryType: v as BoundaryType }) },
            { label: 'Start cap', value: startCap === MIXED ? '' : startCap, mixed: startCap === MIXED, options: CAP_OPTS, onChange: (v) => setAll({ startCap: v as CapStyle }) },
          ]}
          end={[
            { label: 'End boundary', value: endB === MIXED ? '' : endB, mixed: endB === MIXED, options: BOUNDARY_OPTS, onChange: (v) => setAll({ endBoundaryType: v as BoundaryType }) },
            { label: 'End cap', value: endCap === MIXED ? '' : endCap, mixed: endCap === MIXED, options: CAP_OPTS, onChange: (v) => setAll({ endCap: v as CapStyle }) },
          ]}
        />

        {/* Stroke */}
        <Field label="Stroke" helper={lineStyle === MIXED ? 'Mixed' : undefined}>
          <Segmented
            options={LINESTYLE_OPTS}
            value={lineStyle === MIXED ? ('' as LineStyle) : lineStyle}
            onChange={(v) => setAll({ lineStyle: v })}
          />
        </Field>

        {/* Lyrics — repeating sections (e.g. a chorus) often share lyrics */}
        <Field label="Lyrics">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={lyrics === MIXED ? '' : lyrics}
            placeholder={lyrics === MIXED ? 'Mixed. Type to set all.' : ''}
            onChange={(e) => setAll({ lyrics: e.target.value || null })}
          />
        </Field>

        {/* Key area — free text, conventionally a Roman numeral relative to homeKey */}
        <Field
          label="Key area"
          tooltip={KEY_AREA_TIP}
          helper={keyArea === MIXED ? 'Mixed' : undefined}
        >
          <input
            className={inputClass}
            value={keyArea === MIXED ? '' : keyArea}
            placeholder={keyArea === MIXED ? 'Mixed. Type to set all.' : KEY_AREA_PLACEHOLDER}
            onChange={(e) => setAll({ keyArea: toAccidentals(e.target.value) || null })}
          />
        </Field>

        {/* Colors */}
        <div className="mt-4 mb-2 border-t pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground" style={{ borderColor: 'var(--hairline)' }}>
          Advanced
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Fill" helper={fill === MIXED ? 'Mixed' : undefined}>
              <ColorPicker
                value={fill === MIXED ? null : fill}
                fallback={fillFallback}
                onChange={(c) => setAll({ fillColor: c })}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Stroke" helper={stroke === MIXED ? 'Mixed' : undefined}>
              <ColorPicker
                value={stroke === MIXED ? null : stroke}
                fallback={strokeFallback}
                onChange={(c) => setAll({ strokeColor: c })}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}

