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
 * swaps the framing copy and starts with "Advanced" folded. Same fields, same
 * live-edit behavior.
 *
 * Up front: title, artist, source, tempo and meter (the last two seed the beat
 * grid). Everything else is under "Advanced", ending with the read-only
 * identity fields (duration, created/updated, file format version), which are
 * derived, not edited here.
 */

import { useRef, useState } from 'react'
import { ChevronRight, Info } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { formatClock } from '@/lib/youtube'
import { BUILT_IN_MODES } from '@/lib/modes'
import { SourceLinkForm } from '@/components/LinkSourceDialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Field, inputClass } from '@/components/Field'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toAccidentals } from '@/lib/musicSymbols'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { AnalysisContext, TimeSignature, HomeKey } from '@/types/strata'

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
  // Noticed during render, not in an effect (react-hooks/set-state-in-effect).
  const [valueSeen, setValueSeen] = useState(value)
  if (valueSeen !== value) {
    setValueSeen(value)
    if (value != null && !isMajorMinor) setExpanded(true)
  }

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
          <option value="">None</option>
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
          className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
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
  const titleRef = useRef<HTMLInputElement>(null)

  // Local text-input mirrors for fields that need free typing before commit
  // (array/number fields). Re-synced whenever the dialog opens.
  const [artistText, setArtistText] = useState('')
  const [bpmText, setBpmText] = useState('')
  const [tsNumText, setTsNumText] = useState('')
  const [tsDenText, setTsDenText] = useState('')
  const [offsetText, setOffsetText] = useState('')
  // A new analysis asks only for what starting needs (title, artist, source,
  // tempo and meter); everything else waits behind "Advanced". Settings open
  // with it expanded — and so does a new analysis whose advanced details are
  // already filled in (one started from a link, lib/newFromLink.ts), so what
  // was filled in can be checked.
  const [showMore, setShowMore] = useState(!isNew)
  // Both re-seeds below are noticed during render, not in an effect (react-hooks/set-state-in-effect).
  const [framingSeen, setFramingSeen] = useState({ open: false, isNew })
  if (framingSeen.open !== open || framingSeen.isNew !== isNew) {
    setFramingSeen({ open, isNew })
    if (open) {
      const filled = !!doc && (!!doc.homeKey || !!doc.analysisAuthor)
      setShowMore(!isNew || filled)
    }
  }

  // Re-copied when the dialog opens or one of these values changes (an undo,
  // a link filling them in), not on every document change: the media's length
  // arriving while the analyst types a tempo used to wipe what they'd typed.
  const mirrored = doc
    ? JSON.stringify([doc.artist, doc.bpm, doc.timeSignature, doc.source.sourceOffset])
    : ''
  const [mirrorsSeen, setMirrorsSeen] = useState({ open: false, mirrored: '' })
  if (mirrorsSeen.open !== open || mirrorsSeen.mirrored !== mirrored) {
    setMirrorsSeen({ open, mirrored })
    if (open && doc) {
      setArtistText(doc.artist.join(', '))
      setBpmText(doc.bpm != null ? String(doc.bpm) : '')
      setTsNumText(doc.timeSignature ? String(doc.timeSignature.numerator) : '')
      setTsDenText(doc.timeSignature ? String(doc.timeSignature.denominator) : '')
      setOffsetText(String(doc.source.sourceOffset))
    }
  }

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
      <DialogContent
        className="max-w-md gap-3"
        // Start in Title, not on the info button beside the heading (which
        // would also pop its tooltip open).
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          titleRef.current?.select()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {isNew ? 'New analysis' : 'Document settings'}
            {isNew && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About this dialog"
                    className="inline-flex rounded text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent>You can change any of this later.</TooltipContent>
              </Tooltip>
            )}
          </DialogTitle>
          <DialogDescription className={isNew ? 'sr-only' : undefined}>
            {isNew ? 'You can change any of this later.' : 'About the track and this analysis.'}
          </DialogDescription>
        </DialogHeader>

        <div>
          <Field label="Title">
            <input
              ref={titleRef}
              className={inputClass}
              value={doc.title}
              onChange={(e) => updateMeta({ title: e.target.value })}
            />
          </Field>

          <Field label="Artist" helper="Separate several artists with commas.">
            <input
              className={inputClass}
              value={artistText}
              onChange={(e) => setArtistText(e.target.value)}
              onBlur={commitArtist}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </Field>

          <Field label="Source" tooltip="You can swap it any time; the analysis stays as it is.">
            <SourceLinkForm />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Tempo (BPM)"
              tooltip="The beat grid starts at this tempo and meter, so bars line up for faster drawing."
            >
              <input
                className={inputClass}
                inputMode="decimal"
                placeholder="e.g. 120"
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
                  aria-label="Beats per bar"
                  inputMode="numeric"
                  placeholder="4"
                  value={tsNumText}
                  onChange={(e) => setTsNumText(e.target.value)}
                  onBlur={commitTimeSignature}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className="text-xs text-muted-foreground">/</span>
                <input
                  className={inputClass}
                  aria-label="Beat unit"
                  inputMode="numeric"
                  placeholder="4"
                  value={tsDenText}
                  onChange={(e) => setTsDenText(e.target.value)}
                  onBlur={commitTimeSignature}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </div>
            </Field>
          </div>

          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="mb-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={'h-3.5 w-3.5 transition-transform' + (showMore ? ' rotate-90' : '')}
              aria-hidden
            />
            Advanced
          </button>

          {showMore && (
          <div className="mb-3 border-l border-border pl-3">
          <Field label="Context" helper="For corpus analysis: a studio recording or a live performance.">
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

          <Field label="Work" tooltip="Analyses that name the same work can be compared across files.">
            <input
              className={inputClass}
              placeholder="e.g. Op. 13"
              value={doc.work ?? ''}
              onChange={(e) => updateMeta({ work: e.target.value || null })}
            />
          </Field>

          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">Home key</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tonic">
              <input
                className={inputClass}
                placeholder="e.g. A, F♯, B♭"
                value={doc.homeKey?.tonic ?? ''}
                onChange={(e) => commitHomeKey({ tonic: toAccidentals(e.target.value) })}
              />
            </Field>
            <Field label="Mode">
              <ModePicker
                value={doc.homeKey?.mode ?? null}
                customModes={doc.vocabulary.modes}
                onChange={(mode) => commitHomeKey({ mode })}
              />
            </Field>
          </div>

          <Field label="Cadence marker captions">
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
            label="Sync offset (seconds)"
            tooltip="Where the music starts in the video, if not at 0:00."
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
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            <p>Duration: {formatClock(doc.duration)}</p>
            <p>
              Created {new Date(doc.createdAt).toLocaleString()} · Updated{' '}
              {new Date(doc.updatedAt).toLocaleString()}
            </p>
            <p>
              Strata {doc.strataVersion} · File format v{doc.fileFormatVersion}
            </p>
          </div>
          </div>
          )}

          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                commitArtist()
                onOpenChange(false)
              }}
            >
              {isNew ? 'Start' : 'Done'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
