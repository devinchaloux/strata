/**
 * MergeConflictDialog — the conflict-only resolution dialog (Merge UX §5).
 *
 * Renders from uiStore.mergeDialog (set by useMerge when a merge has competing
 * fields). Shows one radio group per conflicting field plus a read-only
 * "Auto-resolved" summary so the analyst sees the full picture. Confirm is
 * disabled until every conflict has a choice; Cancel/Escape/overlay/X all abandon
 * the merge with the source spans untouched.
 */

import { useEffect, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { finalizeMerge, NOTE_SEPARATOR, type ConflictField } from '@/lib/mergeSpans'
import { formatTime } from '@/lib/youtube'
import type { FormDiagramData } from '@/types/strata'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const FIELD_LABEL: Record<ConflictField, string> = {
  label: 'Label',
  type: 'Type',
  annotation: 'Annotation',
  fillColor: 'Fill',
  strokeColor: 'Stroke',
  parentId: 'Parent',
}

const COLOR_FIELDS: ConflictField[] = ['fillColor', 'strokeColor']

export function MergeConflictDialog() {
  const mergeDialog = useUIStore((s) => s.mergeDialog)
  const closeMergeDialog = useUIStore((s) => s.closeMergeDialog)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const mergeSpansAction = useDocumentStore((s) => s.mergeSpans)
  const doc = useDocumentStore((s) => s.document)

  // One choice per conflict field. Encoded so null ("layer default" / "None")
  // round-trips through a string radio value.
  const [choices, setChoices] = useState<Record<string, string>>({})

  // Reset choices whenever a new merge opens.
  useEffect(() => {
    setChoices({})
  }, [mergeDialog])

  if (!mergeDialog) return null
  const { layerId, sourceIds, draft, conflicts } = mergeDialog

  const allChosen = conflicts.every((c) => choices[c.field] !== undefined)

  // Display helpers ---------------------------------------------------------
  const spanTypes = doc?.vocabulary.spanTypes ?? []
  const allSpans =
    doc?.layers.flatMap((l) =>
      l.type === 'form-diagram' ? (l.data as FormDiagramData).spans : [],
    ) ?? []

  function optionLabel(field: ConflictField, value: string | null): string {
    if (value === null) return field === 'parentId' ? 'None' : 'Layer default'
    if (field === 'type') return spanTypes.find((t) => t.id === value)?.label ?? value
    if (field === 'parentId') {
      const s = allSpans.find((x) => x.id === value)
      return s?.label || s?.slug || value
    }
    return value
  }

  // null encodes as the sentinel "\0null"; everything else is its own string.
  const NULL_SENTINEL = '\0null'
  const encode = (v: string | null) => (v === null ? NULL_SENTINEL : v)
  const decode = (v: string): string | null => (v === NULL_SENTINEL ? null : v)

  function confirm() {
    const resolved: Partial<Record<ConflictField, string | null>> = {}
    for (const c of conflicts) {
      resolved[c.field] = decode(choices[c.field])
    }
    const final = finalizeMerge(draft, resolved)
    mergeSpansAction(layerId, sourceIds, final)
    selectSpan(final.id)
    closeMergeDialog()
  }

  // Auto-resolved read-only summary -----------------------------------------
  const noteCount = draft.notes ? draft.notes.split(NOTE_SEPARATOR).length : 0
  const lyricCount = draft.lyrics ? draft.lyrics.split(NOTE_SEPARATOR).length : 0
  const autoRows: { label: string; value: string }[] = [
    { label: 'Time range', value: `${formatTime(draft.startTime)} → ${formatTime(draft.endTime)}` },
    { label: 'Confidence', value: `${draft.confidence ?? 'definite'} (lowest of selected)` },
  ]
  if (noteCount > 0)
    autoRows.push({ label: 'Notes', value: `combined (${noteCount} ${noteCount === 1 ? 'entry' : 'entries'})` })
  if (lyricCount > 0)
    autoRows.push({ label: 'Lyrics', value: `combined (${lyricCount} ${lyricCount === 1 ? 'entry' : 'entries'})` })

  return (
    <Dialog open onOpenChange={(open) => !open && closeMergeDialog()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {sourceIds.length} spans</DialogTitle>
          <DialogDescription>
            Some fields have competing values. Choose what to use in the merged span.
          </DialogDescription>
        </DialogHeader>

        {/* Resolve — interactive radio groups */}
        <div className="space-y-4">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Resolve
          </div>
          {conflicts.map((c) => (
            <fieldset key={c.field}>
              <legend className="mb-1 text-xs font-medium text-foreground">
                {FIELD_LABEL[c.field]}
              </legend>
              <div className="space-y-1">
                {c.options.map((opt) => {
                  const val = encode(opt)
                  const checked = choices[c.field] === val
                  return (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent"
                    >
                      <input
                        type="radio"
                        name={c.field}
                        checked={checked}
                        onChange={() => setChoices((prev) => ({ ...prev, [c.field]: val }))}
                      />
                      {COLOR_FIELDS.includes(c.field) && opt !== null && (
                        <span
                          className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-border"
                          style={{ backgroundColor: opt }}
                        />
                      )}
                      <span className="text-foreground">{optionLabel(c.field, opt)}</span>
                      {COLOR_FIELDS.includes(c.field) && opt !== null && (
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{opt}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* Auto-resolved — read-only */}
        <div className="space-y-1 border-t pt-3" style={{ borderColor: 'var(--hairline)' }}>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Auto-resolved
          </div>
          {autoRows.map((r) => (
            <div key={r.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="text-foreground">{r.value}</span>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={closeMergeDialog}>
            Cancel
          </Button>
          <Button size="sm" disabled={!allChosen} onClick={confirm}>
            Merge spans →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
