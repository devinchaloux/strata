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
import { formatTime } from '@/lib/youtube'
import { parseTimecode } from '@/lib/timecode'
import { MIN_SPAN_WIDTH } from '@/lib/spanEdit'
import { slugify } from '@/lib/slug'
import type {
  Span,
  Layer,
  FormDiagramData,
  ConfidenceLevel,
  BoundaryType,
  LineType,
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

/** Find the selected span and the layer that owns it. */
function findSelected(
  layers: Layer[],
  spanId: string | null,
): { layer: Layer; span: Span } | null {
  if (!spanId) return null
  for (const layer of layers) {
    const span = (layer.data as FormDiagramData).spans.find((s) => s.id === spanId)
    if (span) return { layer, span }
  }
  return null
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

const LINETYPE_OPTS: { value: LineType; label: string }[] = [
  { value: 'flat', label: 'Bracket' },
  { value: 'arc', label: 'Arc' },
]

// ---------------------------------------------------------------------------
// MetadataPanel
// ---------------------------------------------------------------------------

export function MetadataPanel() {
  const doc = useDocumentStore((s) => s.document)
  const updateSpan = useDocumentStore((s) => s.updateSpan)
  const removeSpan = useDocumentStore((s) => s.removeSpan)
  const addSpan = useDocumentStore((s) => s.addSpan)
  const placeBoundary = useDocumentStore((s) => s.placeBoundary)
  const selectedSpanId = useUIStore((s) => s.selectedSpanId)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const currentTime = useUIStore((s) => s.currentTime)

  const found = findSelected(doc?.layers ?? [], selectedSpanId)
  if (!found) return null

  const { layer, span } = found
  const update = (patch: Partial<Omit<Span, 'id'>>) => updateSpan(layer.id, span.id, patch)

  const spanTypes = doc?.vocabulary.spanTypes ?? []

  function handleDelete() {
    removeSpan(layer.id, span.id)
    selectSpan(null)
  }

  function handleDuplicate() {
    const copy: Span = { ...span, id: crypto.randomUUID() }
    addSpan(layer.id, copy)
    selectSpan(copy.id)
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
    <aside
      className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l bg-card"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--hairline)' }}>
        <span className="text-xs font-medium text-foreground">Span</span>
        <button
          onClick={() => selectSpan(null)}
          className="text-muted-foreground hover:text-foreground"
          title="Close"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

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

        {/* Line style */}
        <Field label="Line style">
          <Segmented
            options={LINETYPE_OPTS}
            value={span.lineType ?? 'arc'}
            onChange={(v) => update({ lineType: v })}
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
              <ColorControl
                value={span.fillColor}
                fallback={layer.fillColorDefault}
                onChange={(c) => update({ fillColor: c })}
              />
            </Field>
          </div>
          <div className="flex-1">
            <Field label="Stroke">
              <ColorControl
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

        {/* Actions */}
        <div className="mt-4 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <button
            onClick={handleSplit}
            disabled={!canSplit}
            title={canSplit ? 'Split at playhead' : 'Move the playhead inside this span to split'}
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent disabled:opacity-40"
          >
            Split
          </button>
          <button
            onClick={handleDuplicate}
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            Duplicate
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 rounded px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Color control — a swatch input plus a "layer default" clear (null = inherit).
// The curated swatch palette (Phase 0.6) is a later refinement.
// ---------------------------------------------------------------------------

function ColorControl({
  value,
  fallback,
  onChange,
}: {
  value: string | null | undefined
  fallback: string
  onChange: (c: string | null) => void
}) {
  const inheriting = value == null
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value ?? fallback}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-7 shrink-0 cursor-pointer rounded border border-border bg-card p-0.5"
        title={inheriting ? `Layer default ${fallback}` : value ?? ''}
      />
      <button
        onClick={() => onChange(null)}
        disabled={inheriting}
        className="flex-1 truncate rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-accent disabled:opacity-50"
        title="Reset to layer default"
      >
        {inheriting ? 'Default' : 'Reset'}
      </button>
    </div>
  )
}
