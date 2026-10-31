/**
 * GroupPopover — "Group into…" (several selected spans) and "Copy to layer…"
 * (one span), in the Inspector.
 *
 * Both list the other form layers, each with what placing the span there
 * would do to it: fits an empty stretch, or replaces and cuts back the spans
 * already there (lib/groupSpans.ts groupPreview). Grouping lists the layer
 * just above first and ends with a new layer just above; copying lists the
 * layers in drawing order, each marked above or below, and ends with a new
 * layer above or below. Picking one makes the span there and selects it. One
 * undo step. docs/decisions.md, "Group Spans Into Another Layer" and "Schema
 * Review: Three Fields Cut".
 */
import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore, type GroupTarget } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { formSpans } from '@/lib/layers'
import { groupPreview, layerAbove, COPY_FIELDS, type CopyField } from '@/lib/groupSpans'
import type { Span } from '@/types/strata'

function effect(p: { replaced: number; cut: number }): string {
  if (!p.replaced && !p.cut) return 'fits'
  const parts = [
    p.replaced ? `replaces ${p.replaced} span${p.replaced === 1 ? '' : 's'}` : '',
    p.cut ? `cuts ${p.cut} back` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

const inputClass =
  'min-w-0 flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'

/** The layer list and new-layer row both pickers share. */
function useTargets(spans: Span[], copy: boolean) {
  const doc = useDocumentStore((s) => s.document)
  const groupSpans = useDocumentStore((s) => s.groupSpans)
  const selectSpan = useUIStore((s) => s.selectSpan)
  if (!doc) return null
  const ids = spans.map((s) => s.id)
  const start = Math.min(...spans.map((s) => s.startTime))
  const end = Math.max(...spans.map((s) => s.endTime))
  const sources = doc.layers.filter((l) => formSpans(l).some((s) => ids.includes(s.id)))
  const top = [...sources].sort((a, b) => b.displayOrder - a.displayOrder)[0]
  const above = top ? layerAbove(doc.layers, top) : null
  const targets = doc.layers
    .filter((l) => l.type === 'form-diagram' && !sources.includes(l))
    .sort((a, b) =>
      copy ? b.displayOrder - a.displayOrder : a.id === above?.id ? -1 : b.id === above?.id ? 1 : b.displayOrder - a.displayOrder,
    )
    .map((l) => ({
      layer: l,
      preview: groupPreview(formSpans(l), start, end),
      where: copy ? (top && l.displayOrder > top.displayOrder ? 'above' : 'below') : l.id === above?.id ? 'just above' : null,
    }))
  /** Place the span; true when it was made (and is now selected). */
  const place = (target: GroupTarget, fields?: CopyField[]) => {
    const id = groupSpans(ids, target, fields)
    if (id) selectSpan(id)
    return !!id
  }
  return { targets, place }
}

function TargetList({ targets, onPick }: { targets: NonNullable<ReturnType<typeof useTargets>>['targets']; onPick: (target: GroupTarget) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      {targets.map(({ layer: l, preview: p, where }) => (
        <button
          key={l.id}
          disabled={l.locked}
          onClick={() => onPick({ layerId: l.id })}
          className="flex items-baseline justify-between gap-2 rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-50"
        >
          <span className="truncate text-foreground">
            {l.label}
            {where && <span className="text-muted-foreground"> · {where}</span>}
          </span>
          <span className={`shrink-0 text-[11px] ${p.replaced || p.cut ? 'text-destructive' : 'text-muted-foreground'}`}>
            {l.locked ? 'locked' : effect(p)}
          </span>
        </button>
      ))}
    </div>
  )
}

export function GroupPopover({ spans }: { spans: Span[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const t = useTargets(spans, false)
  if (!t) return null

  function group(target: GroupTarget) {
    if (!t!.place(target)) return
    setOpen(false)
    setName('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="mb-4 w-full rounded border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          title="One span over all of these, on another layer"
        >
          Group into…
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 text-xs">
        <p className="px-1 pb-1.5 font-medium text-foreground">Group {spans.length} spans into</p>
        <TargetList targets={t.targets} onPick={group} />
        <form
          className="mt-1.5 flex items-center gap-1.5 border-t border-border px-1 pt-2"
          onSubmit={(e) => {
            e.preventDefault()
            group({ newLayer: name })
          }}
        >
          <input
            aria-label="New layer name"
            placeholder="New layer just above"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button type="submit" className="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-accent">
            Create
          </button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Copy one span to any other form layer or a new one above or below, taking
 * the parts ticked under "What to copy" (lyrics, notes and commentary start
 * off). The span's right-click menu opens it here (copyPickerPending).
 */
export function CopyToLayerPopover({ span }: { span: Span }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const pending = useUIStore((s) => s.copyPickerPending)
  const clearRequest = useUIStore((s) => s.clearCopyPickerRequest)
  const fields = useUIStore((s) => s.copyFields)
  const setFields = useUIStore((s) => s.setCopyFields)
  // A request opens it, noticed during render, then is cleared (as ColorPicker's).
  if (pending && !open) setOpen(true)
  useEffect(() => {
    if (pending && open) clearRequest()
  }, [pending, open, clearRequest])
  const t = useTargets([span], true)
  if (!t) return null

  function copy(target: GroupTarget) {
    if (!t!.place(target, fields)) return
    setOpen(false)
    setName('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          title="Copy this span to another layer"
          className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          Copy to layer…
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 text-xs">
        <p className="px-1 pb-1.5 font-medium text-foreground">Copy to</p>
        <TargetList targets={t.targets} onPick={copy} />
        <fieldset className="mt-1.5 border-t border-border px-1 pt-2">
          <legend className="sr-only">What to copy</legend>
          <p className="pb-1 text-[11px] text-muted-foreground">What to copy</p>
          <div className="grid grid-cols-2 gap-x-2">
            {COPY_FIELDS.map((f) => (
              <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent">
                <input
                  type="checkbox"
                  checked={fields.includes(f.id)}
                  onChange={(e) => setFields(e.target.checked ? [...fields, f.id] : fields.filter((x) => x !== f.id))}
                />
                {f.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-border px-1 pt-2">
          <input
            aria-label="New layer name"
            placeholder="New layer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') copy({ newLayer: name })
            }}
            className={inputClass}
          />
          <button onClick={() => copy({ newLayer: name })} className="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-accent">
            Above
          </button>
          <button
            onClick={() => copy({ newLayer: name, below: true })}
            className="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-accent"
          >
            Below
          </button>
        </div>
        <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">
          The span on the higher layer becomes the other’s parent, so the boundaries they share move together.
        </p>
      </PopoverContent>
    </Popover>
  )
}
