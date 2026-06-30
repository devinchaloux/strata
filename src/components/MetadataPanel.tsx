/**
 * MetadataPanel — the right sidebar for the selected span (Phase 0.4 §5).
 *
 * Appears when a span is selected; every control live-dispatches to the document
 * store, so edits are undo-covered (zundo) automatically. Field set and order
 * follow the 0.4 spec. Deferred within this slice: click-to-seek on the time
 * range (needs the player wired globally — slice 3), the curated color swatch
 * picker (basic color inputs for now), and Split at playhead (shares logic with
 * spacebar placement — slice 3).
 */

import { useState, useEffect } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { useMerge } from '@/hooks/useMerge'
import { formatTime } from '@/lib/youtube'
import { parseTimecode } from '@/lib/timecode'
import { MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import { capFromBoundaryType } from '@/lib/formShape'
import { slugify } from '@/lib/slug'
import { ColorPicker } from '@/components/ui/color-picker'
import type {
  Span,
  Layer,
  FormDiagramData,
  ConfidenceLevel,
  BoundaryType,
  CapStyle,
  LineStyle,
} from '@/types/strata'

// ---------------------------------------------------------------------------
// Small field primitives
// ---------------------------------------------------------------------------

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {helper && <p className="mt-0.5 text-[10px] text-muted-foreground">{helper}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

/**
 * Editable timecode field. Shows the formatted value; on Enter/blur it parses
 * the text and commits (the parent clamps it). Escape or an unparseable value
 * restores the current value.
 */
function TimeInput({
  value,
  onCommit,
  title,
}: {
  value: number
  onCommit: (seconds: number) => void
  title: string
}) {
  const [text, setText] = useState(() => formatTime(value))
  // Re-sync when the underlying value changes (commit result, undo, reselect).
  useEffect(() => setText(formatTime(value)), [value])

  function commit() {
    const parsed = parseTimecode(text)
    if (parsed == null) setText(formatTime(value))
    else onCommit(parsed)
  }

  return (
    <input
      className="w-[88px] rounded border border-border bg-card px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      value={text}
      title={title}
      aria-label={title}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') {
          setText(formatTime(value))
          e.currentTarget.blur()
        }
      }}
    />
  )
}

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
            className="flex-1 rounded px-1.5 py-0.5 text-[11px] transition-colors"
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

const BOUNDARY_OPTS: { value: BoundaryType; label: string }[] = [
  { value: 'definite', label: 'Definite' },
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
  const doc = useDocumentStore((s) => s.document)
  const updateSpan = useDocumentStore((s) => s.updateSpan)
  const removeSpan = useDocumentStore((s) => s.removeSpan)
  const placeBoundary = useDocumentStore((s) => s.placeBoundary)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const currentTime = useUIStore((s) => s.currentTime)
  const { neighborId, performMerge } = useMerge()

  const prevId = neighborId(span.id, 'prev')
  const nextId = neighborId(span.id, 'next')

  const update = (patch: Partial<Omit<Span, 'id'>>) => updateSpan(layer.id, span.id, patch)

  const spanTypes = doc?.vocabulary.spanTypes ?? []

  function handleDelete() {
    removeSpan(layer.id, span.id)
    selectSpan(null)
  }

  const canSplit = currentTime > span.startTime && currentTime < span.endTime
  function handleSplit() {
    placeBoundary(layer.id, currentTime)
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
  }

  const duration = span.endTime - span.startTime
  const trackDuration = doc?.duration ?? span.endTime

  // Numeric boundary edits — clamped so the span stays valid (≥ MIN_SPAN_WIDTH,
  // within [0, track duration]). Edits this span's own times only.
  function commitStart(t: number) {
    update({ startTime: Math.max(0, Math.min(t, span.endTime - MIN_SPAN_WIDTH)) })
  }
  function commitEnd(t: number) {
    update({ endTime: Math.max(span.startTime + MIN_SPAN_WIDTH, Math.min(t, trackDuration)) })
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
          <div className="mt-1 text-[10px] text-muted-foreground">
            Duration {formatTime(duration)}
          </div>
        </div>

        {/* Label */}
        <Field label="Label">
          <input
            className={inputClass}
            value={span.label ?? ''}
            placeholder="Unlabeled"
            onChange={(e) => {
              const v = e.target.value
              const label = v === '' ? null : v
              update({ label, slug: label ? slugify(label) : null })
            }}
          />
        </Field>

        {/* Slug (read-only, click to copy) */}
        <Field label="Slug">
          <button
            className={`${inputClass} flex items-center justify-between text-left`}
            title="Click to copy"
            onClick={() => span.slug && copy(span.slug)}
            disabled={!span.slug}
          >
            <span className={span.slug ? 'text-foreground' : 'text-muted-foreground'}>
              {span.slug ?? '—'}
            </span>
            {span.slug && <span className="text-[10px] text-muted-foreground">copy</span>}
          </button>
        </Field>

        {/* Type */}
        <Field label="Type">
          <select
            className={inputClass}
            value={span.type ?? ''}
            onChange={(e) => update({ type: e.target.value || null })}
          >
            <option value="">— none —</option>
            {spanTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            {/* Preserve a value not present in the vocab list */}
            {span.type && !spanTypes.some((t) => t.id === span.type) && (
              <option value={span.type}>{span.type}</option>
            )}
          </select>
        </Field>

        {/* Annotation */}
        <Field label="Annotation" helper="Diagram-visible — renders inside the shape">
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

        {/* Boundaries */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Start boundary">
              <select
                className={inputClass}
                value={span.startBoundaryType ?? 'definite'}
                onChange={(e) => update({ startBoundaryType: e.target.value as BoundaryType })}
              >
                {BOUNDARY_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="End boundary">
              <select
                className={inputClass}
                value={span.endBoundaryType ?? 'definite'}
                onChange={(e) => update({ endBoundaryType: e.target.value as BoundaryType })}
              >
                {BOUNDARY_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Shape — visual caps (the analyst's drawing choice; decoupled from the
            boundary-type data above, with a sensible fallback from it). */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Start cap">
              <select
                className={inputClass}
                value={span.startCap ?? capFromBoundaryType(span.startBoundaryType)}
                onChange={(e) => update({ startCap: e.target.value as CapStyle })}
              >
                {CAP_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="End cap">
              <select
                className={inputClass}
                value={span.endCap ?? capFromBoundaryType(span.endBoundaryType)}
                onChange={(e) => update({ endCap: e.target.value as CapStyle })}
              >
                {CAP_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Stroke */}
        <Field label="Stroke">
          <Segmented
            options={LINESTYLE_OPTS}
            value={span.lineStyle ?? 'solid'}
            onChange={(v) => update({ lineStyle: v })}
          />
        </Field>

        {/* Notes */}
        <Field label="Notes" helper="Tooltip only — not shown on the diagram">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={span.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value || null })}
          />
        </Field>

        {/* Lyrics */}
        <Field label="Lyrics" helper="Corpus-queryable">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={span.lyrics ?? ''}
            onChange={(e) => update({ lyrics: e.target.value || null })}
          />
        </Field>

        {/* Advanced */}
        <div className="mt-4 mb-2 border-t pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ borderColor: 'var(--hairline)' }}>
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
            <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">copy</span>
          </button>
        </Field>

        {/* Merge with neighbor (Merge UX §3.4) */}
        <div className="mt-4 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={() => prevId && performMerge([prevId, span.id])}
            disabled={!prevId}
            title={prevId ? 'Merge with previous span' : 'No previous span in this layer'}
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent disabled:opacity-40"
          >
            Merge ←
          </button>
          <button
            onClick={() => nextId && performMerge([span.id, nextId])}
            disabled={!nextId}
            title={nextId ? 'Merge with next span' : 'No next span in this layer'}
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent disabled:opacity-40"
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
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent disabled:opacity-40"
          >
            Split
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
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
  const spanTypes = doc?.vocabulary.spanTypes ?? []

  // Apply a patch to every selected span (one undo step).
  const setAll = (patch: Partial<Omit<Span, 'id'>>) => updateSpans(ids, patch)

  // Resolved common values (or MIXED) per bulk field.
  const label = commonValue(spans, (s) => s.label ?? '')
  const type = commonValue(spans, (s) => s.type ?? '')
  const annotation = commonValue(spans, (s) => s.annotation ?? '')
  const lyrics = commonValue(spans, (s) => s.lyrics ?? '')
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
          <p className="-mt-3 mb-4 text-[10px] text-muted-foreground">{mergeReason}</p>
        )}

        <div className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Apply to all selected
        </div>

        {/* Label */}
        <Field label="Label">
          <input
            className={inputClass}
            value={label === MIXED ? '' : label}
            placeholder={label === MIXED ? 'Mixed — type to set all' : 'Unlabeled'}
            onChange={(e) => {
              const v = e.target.value
              const next = v === '' ? null : v
              setAll({ label: next, slug: next ? slugify(next) : null })
            }}
          />
        </Field>

        {/* Type */}
        <Field label="Type">
          <select
            className={inputClass}
            value={type === MIXED ? '' : type}
            onChange={(e) => setAll({ type: e.target.value || null })}
          >
            <option value="">{type === MIXED ? '— mixed —' : '— none —'}</option>
            {spanTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Annotation */}
        <Field label="Annotation" helper="Diagram-visible — renders inside the shape">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={annotation === MIXED ? '' : annotation}
            placeholder={annotation === MIXED ? 'Mixed — type to set all' : ''}
            onChange={(e) => setAll({ annotation: e.target.value || null })}
          />
        </Field>

        {/* Confidence */}
        <Field label="Confidence" helper={confidence === MIXED ? 'Mixed across selection' : undefined}>
          <Segmented
            options={CONFIDENCE_OPTS}
            value={confidence === MIXED ? ('' as ConfidenceLevel) : confidence}
            onChange={(v) => setAll({ confidence: v })}
          />
        </Field>

        {/* Boundaries */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Start boundary">
              <select
                className={inputClass}
                value={startB === MIXED ? '' : startB}
                onChange={(e) => setAll({ startBoundaryType: e.target.value as BoundaryType })}
              >
                {startB === MIXED && <option value="">— mixed —</option>}
                {BOUNDARY_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="End boundary">
              <select
                className={inputClass}
                value={endB === MIXED ? '' : endB}
                onChange={(e) => setAll({ endBoundaryType: e.target.value as BoundaryType })}
              >
                {endB === MIXED && <option value="">— mixed —</option>}
                {BOUNDARY_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Shape — visual caps + stroke */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Field label="Start cap" helper={startCap === MIXED ? 'Mixed' : undefined}>
              <select
                className={inputClass}
                value={startCap === MIXED ? '' : startCap}
                onChange={(e) => setAll({ startCap: e.target.value as CapStyle })}
              >
                {startCap === MIXED && <option value="">— mixed —</option>}
                {CAP_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex-1">
            <Field label="End cap" helper={endCap === MIXED ? 'Mixed' : undefined}>
              <select
                className={inputClass}
                value={endCap === MIXED ? '' : endCap}
                onChange={(e) => setAll({ endCap: e.target.value as CapStyle })}
              >
                {endCap === MIXED && <option value="">— mixed —</option>}
                {CAP_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Stroke */}
        <Field label="Stroke" helper={lineStyle === MIXED ? 'Mixed across selection' : undefined}>
          <Segmented
            options={LINESTYLE_OPTS}
            value={lineStyle === MIXED ? ('' as LineStyle) : lineStyle}
            onChange={(v) => setAll({ lineStyle: v })}
          />
        </Field>

        {/* Lyrics — repeating sections (e.g. a chorus) often share lyrics */}
        <Field label="Lyrics" helper="Corpus-queryable">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={lyrics === MIXED ? '' : lyrics}
            placeholder={lyrics === MIXED ? 'Mixed — type to set all' : ''}
            onChange={(e) => setAll({ lyrics: e.target.value || null })}
          />
        </Field>

        {/* Colors */}
        <div className="mt-4 mb-2 border-t pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground" style={{ borderColor: 'var(--hairline)' }}>
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

