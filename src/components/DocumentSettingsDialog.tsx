/**
 * DocumentSettingsDialog — global, document-level metadata editor.
 *
 * Edits the StrataDocument fields that live above any single layer/widget:
 * title, artist, context, composer, work, bpm, time signature, notes,
 * project, analysis author, and the source sync offset. Every field
 * live-dispatches to documentStore.updateMeta on commit, so edits are
 * undo-covered automatically — same pattern as MetadataPanel.
 *
 * The Source section embeds SourceLinkForm (set/swap/unlink) — so this dialog
 * doubles as the new-analysis setup modal: "New" opens it with isNew, which
 * only swaps the framing copy. Same fields, same live-edit behavior.
 *
 * Read-only identity fields (duration, created/updated, file format version)
 * are shown in a quiet footer; they're derived, not edited here.
 */

import { useEffect, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { formatTime } from '@/lib/youtube'
import { BUILT_IN_MODES } from '@/lib/modes'
import { SourceLinkForm } from '@/components/LinkSourceDialog'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { AnalysisContext, TimeSignature, HomeKey } from '@/types/strata'

// ---------------------------------------------------------------------------
// Field primitives (local copies of MetadataPanel's — small, not worth sharing)
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
// Mode picker — Major/Minor cover ~90% of analyses in one click; a quiet
// "More modes…" link expands to the full list (built-in church modes +
// project-level custom modes, e.g. Renaissance 8-mode/12-mode systems) via
// the same VocabTerm mechanism as span/point-marker type pickers.
// ---------------------------------------------------------------------------

const MAJOR_MINOR: { value: 'major' | 'minor'; label: string }[] = [
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
]

function ModePicker({
  value,
  customModes,
  onChange,
}: {
  value: string | null
  customModes: { id: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  const isMajorMinor = value === 'major' || value === 'minor'
  const [expanded, setExpanded] = useState(value != null && !isMajorMinor)

  // If the mode changes to something other than Major/Minor (e.g. undo, or a
  // freshly loaded document), auto-expand so it isn't hidden behind the link.
  useEffect(() => {
    if (value != null && !isMajorMinor) setExpanded(true)
  }, [value, isMajorMinor])

  const allModes = [...BUILT_IN_MODES, ...customModes]

  return (
    <div className="space-y-1.5">
      <Segmented
        options={MAJOR_MINOR}
        value={(isMajorMinor ? value : '') as 'major' | 'minor'}
        onChange={(v) => {
          onChange(v)
          setExpanded(false)
        }}
      />
      {expanded ? (
        <select
          className={inputClass}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— none —</option>
          {allModes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          {value && !allModes.some((m) => m.id === value) && (
            <option value={value}>{value}</option>
          )}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        >
          More modes…
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

const CONTEXT_OPTIONS: { value: AnalysisContext | 'unset'; label: string }[] = [
  { value: 'unset', label: 'Unset' },
  { value: 'recording', label: 'Recording' },
  { value: 'performance', label: 'Performance' },
]

export function DocumentSettingsDialog({
  open,
  onOpenChange,
  isNew = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** New-analysis framing: same dialog, setup copy instead of settings copy. */
  isNew?: boolean
}) {
  const doc = useDocumentStore((s) => s.document)
  const updateMeta = useDocumentStore((s) => s.updateMeta)

  // Local text-input mirrors for fields that need free typing before commit
  // (array/number fields). Re-synced whenever the dialog opens.
  const [artistText, setArtistText] = useState('')
  const [bpmText, setBpmText] = useState('')
  const [tsNumText, setTsNumText] = useState('')
  const [tsDenText, setTsDenText] = useState('')
  const [offsetText, setOffsetText] = useState('')

  useEffect(() => {
    if (!open || !doc) return
    setArtistText(doc.artist.join(', '))
    setBpmText(doc.bpm != null ? String(doc.bpm) : '')
    setTsNumText(doc.timeSignature ? String(doc.timeSignature.numerator) : '')
    setTsDenText(doc.timeSignature ? String(doc.timeSignature.denominator) : '')
    setOffsetText(String(doc.source.sourceOffset))
  }, [open, doc])

  if (!doc) return null

  function commitArtist() {
    const list = artistText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    updateMeta({ artist: list.length > 0 ? list : [''] })
  }

  function commitBpm() {
    const n = bpmText.trim() === '' ? null : Number(bpmText)
    updateMeta({ bpm: n != null && Number.isFinite(n) ? n : null })
  }

  function commitTimeSignature() {
    const num = Number(tsNumText)
    const den = Number(tsDenText)
    const ts: TimeSignature | null =
      tsNumText.trim() === '' || tsDenText.trim() === '' || !Number.isFinite(num) || !Number.isFinite(den)
        ? null
        : { numerator: num, denominator: den }
    updateMeta({ timeSignature: ts })
  }

  function commitHomeKey(patch: Partial<HomeKey>) {
    if (!doc) return
    const current = doc.homeKey ?? { tonic: '', mode: null }
    const next = { ...current, ...patch }
    const isEmpty = next.tonic.trim() === '' && next.mode === null
    updateMeta({ homeKey: isEmpty ? null : next })
  }

  function commitOffset() {
    if (!doc) return
    const n = Number(offsetText)
    if (!Number.isFinite(n)) {
      setOffsetText(String(doc.source.sourceOffset))
      return
    }
    updateMeta({ source: { ...doc.source, sourceOffset: n } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New analysis' : 'Document settings'}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Name the track and link the video or audio it plays against. Everything here can be changed later in document settings.'
              : 'Track metadata that applies to the whole analysis, not any single layer.'}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Field label="Title">
            <input
              className={inputClass}
              value={doc.title}
              onChange={(e) => updateMeta({ title: e.target.value })}
            />
          </Field>

          <Field label="Artist" helper="Comma-separated for multiple artists">
            <input
              className={inputClass}
              value={artistText}
              onChange={(e) => setArtistText(e.target.value)}
              onBlur={commitArtist}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>

          <Field label="Context">
            <Segmented
              options={CONTEXT_OPTIONS}
              value={doc.context ?? 'unset'}
              onChange={(v) => updateMeta({ context: v === 'unset' ? null : v })}
            />
          </Field>

          {doc.context === 'performance' && (
            <Field label="Composer">
              <input
                className={inputClass}
                value={doc.composer ?? ''}
                onChange={(e) => updateMeta({ composer: e.target.value || null })}
              />
            </Field>
          )}

          <Field
            label="Source"
            helper="Span timestamps store recording time — swapping the source never touches analysis data"
          >
            <div className="rounded border border-border p-2">
              <SourceLinkForm />
            </div>
          </Field>

          <Field label="Work" helper={'E.g. "Op. 13" — enables cross-file corpus comparison'}>
            <input
              className={inputClass}
              value={doc.work ?? ''}
              onChange={(e) => updateMeta({ work: e.target.value || null })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="BPM">
              <input
                className={inputClass}
                value={bpmText}
                onChange={(e) => setBpmText(e.target.value)}
                onBlur={commitBpm}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </Field>
            <Field label="Time signature">
              <div className="flex items-center gap-1">
                <input
                  className={inputClass}
                  placeholder="4"
                  value={tsNumText}
                  onChange={(e) => setTsNumText(e.target.value)}
                  onBlur={commitTimeSignature}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className="text-xs text-muted-foreground">/</span>
                <input
                  className={inputClass}
                  placeholder="4"
                  value={tsDenText}
                  onChange={(e) => setTsDenText(e.target.value)}
                  onBlur={commitTimeSignature}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Home key — tonic">
              <input
                className={inputClass}
                placeholder="e.g. A, F#, Bb"
                value={doc.homeKey?.tonic ?? ''}
                onChange={(e) => commitHomeKey({ tonic: e.target.value })}
              />
            </Field>
            <Field label="Home key — mode">
              <ModePicker
                value={doc.homeKey?.mode ?? null}
                customModes={doc.vocabulary.modes}
                onChange={(mode) => commitHomeKey({ mode })}
              />
            </Field>
          </div>

          <Field
            label="Cadence marker captions"
            helper="Point markers are document-level, not per-layer, so this is a single switch for the whole file"
          >
            <label className="flex cursor-pointer items-center justify-between rounded border border-border px-2 py-1.5">
              <span className="text-xs text-foreground">Show on diagram</span>
              <Switch
                checked={doc.showCadenceCaptions ?? true}
                onCheckedChange={(v) => updateMeta({ showCadenceCaptions: v })}
                aria-label="Show cadence marker captions on diagram"
              />
            </label>
          </Field>

          <Field label="Notes">
            <textarea
              className={inputClass + ' min-h-[60px] resize-y'}
              value={doc.notes ?? ''}
              onChange={(e) => updateMeta({ notes: e.target.value || null })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project">
              <input
                className={inputClass}
                value={doc.project ?? ''}
                onChange={(e) => updateMeta({ project: e.target.value || null })}
              />
            </Field>
            <Field label="Analysis author">
              <input
                className={inputClass}
                value={doc.analysisAuthor ?? ''}
                onChange={(e) => updateMeta({ analysisAuthor: e.target.value || null })}
              />
            </Field>
          </div>

          <Field
            label="Source sync offset (seconds)"
            helper="player_time = recording_time + offset — correct this if the source video doesn't start at the recording's true start"
          >
            <input
              className={inputClass}
              value={offsetText}
              onChange={(e) => setOffsetText(e.target.value)}
              onBlur={commitOffset}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>

          {/* Read-only identity footer */}
          <div className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <p>Duration: {formatTime(doc.duration)}</p>
            <p>
              Created {new Date(doc.createdAt).toLocaleString()} · Updated{' '}
              {new Date(doc.updatedAt).toLocaleString()}
            </p>
            <p>
              Strata {doc.strataVersion} · File format v{doc.fileFormatVersion}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
