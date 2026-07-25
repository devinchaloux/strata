/**
 * PointMarkerPanel — Inspector content for the selected point marker
 * (build-plan Phase 3.2). Document-level, so no layer context is needed.
 *
 * Field set: timestamp, label, kind (soft UI preset), type (minimal vocabulary
 * picker), harmonicContext (free text, corpus-queryable), notes, flagged,
 * confidence. `kind` only changes which of [type, harmonicContext, flagged,
 * confidence] the panel leads with — every field stays reachable under "more
 * fields" regardless of kind. See docs/decisions.md "Point Markers — Kind
 * Selector" for the rationale.
 */

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { formatTime } from '@/lib/youtube'
import { parseTimecode } from '@/lib/timecode'
import type { ConfidenceLevel, PointMarker } from '@/types/strata'

const inputClass =
  'w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground ' +
  'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'

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

const CONFIDENCE_OPTS: { value: ConfidenceLevel; label: string }[] = [
  { value: 'definite', label: 'Definite' },
  { value: 'approximate', label: 'Approx.' },
  { value: 'speculative', label: 'Spec.' },
]

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

// ---------------------------------------------------------------------------
// Kind — a soft UI preset (docs/decisions.md). Picks which of the four
// optional fields below lead the panel; never restricts what a marker can
// actually store. Omit/undefined behaves like 'other' (today's full panel).
// ---------------------------------------------------------------------------

type MarkerKind = NonNullable<PointMarker['kind']>
type OptionalFieldKey = 'type' | 'harmonicContext' | 'flagged' | 'confidence'

const KIND_OPTIONS: { value: MarkerKind; label: string }[] = [
  { value: 'other', label: 'Other' },
  { value: 'cadence', label: 'Cadence' },
  { value: 'key-change', label: 'Key change' },
  { value: 'tempo-change', label: 'Tempo change' },
  { value: 'flag', label: 'Flag / Note' },
]

const ALL_OPTIONAL_FIELDS: OptionalFieldKey[] = ['type', 'harmonicContext', 'flagged', 'confidence']

const KIND_PROMINENT_FIELDS: Record<MarkerKind, OptionalFieldKey[]> = {
  cadence: ['type', 'harmonicContext', 'confidence'],
  'key-change': ['type', 'harmonicContext', 'confidence'],
  'tempo-change': ['type', 'confidence'],
  flag: ['flagged', 'confidence'],
  other: ALL_OPTIONAL_FIELDS,
}

export function PointMarkerPanel() {
  const doc = useDocumentStore((s) => s.document)
  const updatePointMarker = useDocumentStore((s) => s.updatePointMarker)
  const removePointMarker = useDocumentStore((s) => s.removePointMarker)
  const selectedId = useUIStore((s) => s.selectedPointMarkerId)
  const selectPointMarker = useUIStore((s) => s.selectPointMarker)

  const marker = doc?.pointMarkers.find((m) => m.id === selectedId)

  // Collapse "more fields" whenever the selected marker changes. Declared
  // before the early return below so hook order stays stable regardless of
  // whether a marker is currently selected (Rules of Hooks).
  const [moreExpanded, setMoreExpanded] = useState(false)
  useEffect(() => setMoreExpanded(false), [marker?.id])

  if (!doc || !marker) return null

  const update = (patch: Partial<Omit<PointMarker, 'id'>>) => updatePointMarker(marker.id, patch)

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
  }

  const markerTypes = doc!.vocabulary.pointMarkerTypes

  function handleDelete() {
    removePointMarker(marker!.id)
    selectPointMarker(null)
  }

  const kind: MarkerKind = marker.kind ?? 'other'
  const prominent = KIND_PROMINENT_FIELDS[kind]
  const hidden = ALL_OPTIONAL_FIELDS.filter((f) => !prominent.includes(f))

  function fieldNode(key: OptionalFieldKey) {
    switch (key) {
      case 'type':
        return (
          <Field key="type" label="Type">
            <select
              className={inputClass}
              value={marker!.type ?? ''}
              onChange={(e) => update({ type: e.target.value || null })}
            >
              <option value="">— none —</option>
              {markerTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              {marker!.type && !markerTypes.some((t) => t.id === marker!.type) && (
                <option value={marker!.type}>{marker!.type}</option>
              )}
            </select>
          </Field>
        )
      case 'harmonicContext':
        return (
          <Field
            key="harmonicContext"
            label="Harmonic context"
            helper="Free text, conventionally a Roman numeral relative to the document's home key — e.g. 'V' for a half cadence in the dominant"
          >
            <input
              className={inputClass}
              value={marker!.harmonicContext ?? ''}
              placeholder="None"
              onChange={(e) => update({ harmonicContext: e.target.value || null })}
            />
          </Field>
        )
      case 'flagged':
        return (
          <Field key="flagged" label="Flagged" helper="Come back to this">
            <Segmented
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]}
              value={marker!.flagged ? 'yes' : 'no'}
              onChange={(v) => update({ flagged: v === 'yes' })}
            />
          </Field>
        )
      case 'confidence':
        return (
          <Field key="confidence" label="Confidence">
            <Segmented
              options={CONFIDENCE_OPTS}
              value={marker!.confidence ?? 'definite'}
              onChange={(v) => update({ confidence: v })}
            />
          </Field>
        )
    }
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-3">
        {/* Timestamp */}
        <div className="mb-3 rounded bg-muted px-2 py-1.5">
          <div className="flex items-center justify-center">
            <TimeInput
              value={marker.timestamp}
              onCommit={(t) => update({ timestamp: Math.max(0, Math.min(t, doc.duration)) })}
              title="Timestamp"
            />
          </div>
        </div>

        {/* Label */}
        <Field label="Label">
          <input
            className={inputClass}
            value={marker.label ?? ''}
            placeholder="Unlabeled"
            onChange={(e) => update({ label: e.target.value || null })}
          />
        </Field>

        {/* Kind — soft preset, picks which fields below lead the panel */}
        <Field label="Kind" helper="Changes which fields lead below — every field stays reachable">
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => update({ kind: e.target.value as MarkerKind })}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Kind-prominent fields */}
        {prominent.map((k) => fieldNode(k))}

        {/* Notes — always shown regardless of kind */}
        <Field label="Notes">
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            value={marker.notes ?? ''}
            onChange={(e) => update({ notes: e.target.value || null })}
          />
        </Field>

        {/* More fields — the rest of the optional set, tucked away by kind but
            never removed. Nothing to expand when kind = 'other'. */}
        {hidden.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setMoreExpanded((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              {moreExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              More fields
            </button>
            {moreExpanded && <div className="mt-2">{hidden.map((k) => fieldNode(k))}</div>}
          </div>
        )}

        {/* ID (read-only, copy) */}
        <Field label="ID">
          <button
            className={`${inputClass} flex items-center justify-between text-left`}
            title="Click to copy"
            onClick={() => copy(marker.id)}
          >
            <span className="truncate text-muted-foreground">{marker.id}</span>
            <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">copy</span>
          </button>
        </Field>

        {/* Actions */}
        <div className="mt-2">
          <button
            onClick={handleDelete}
            className="w-full rounded px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
