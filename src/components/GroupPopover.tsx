/**
 * GroupPopover — "Group into…", for several selected spans in the Inspector.
 *
 * Lists the other form layers, the one just above the selection first, each
 * with what grouping there would do to it: fits an empty stretch, or replaces
 * and cuts back the spans already there (lib/groupSpans.ts groupPreview). A
 * last row makes a new layer just above. Picking one makes a blank span over
 * the whole selection there and selects it, ready to label. One undo step.
 * docs/decisions.md, "Group Spans Into Another Layer".
 */
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { formSpans } from '@/lib/layers'
import { groupPreview, layerAbove } from '@/lib/groupSpans'
import type { Span } from '@/types/strata'

function effect(p: { replaced: number; cut: number }): string {
  if (!p.replaced && !p.cut) return 'fits'
  const parts = [
    p.replaced ? `replaces ${p.replaced} span${p.replaced === 1 ? '' : 's'}` : '',
    p.cut ? `cuts ${p.cut} back` : '',
  ].filter(Boolean)
  return parts.join(', ')
}

export function GroupPopover({ spans }: { spans: Span[] }) {
  const doc = useDocumentStore((s) => s.document)
  const groupSpans = useDocumentStore((s) => s.groupSpans)
  const selectSpan = useUIStore((s) => s.selectSpan)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  if (!doc) return null

  const ids = spans.map((s) => s.id)
  const start = Math.min(...spans.map((s) => s.startTime))
  const end = Math.max(...spans.map((s) => s.endTime))
  const sources = doc.layers.filter((l) => formSpans(l).some((s) => ids.includes(s.id)))
  const top = [...sources].sort((a, b) => b.displayOrder - a.displayOrder)[0]
  const above = top ? layerAbove(doc.layers, top) : null
  const targets = doc.layers
    .filter((l) => l.type === 'form-diagram' && !sources.includes(l))
    .sort((a, b) => (a.id === above?.id ? -1 : b.id === above?.id ? 1 : b.displayOrder - a.displayOrder))

  function group(target: { layerId: string } | { newLayer: string }) {
    const id = groupSpans(ids, target)
    if (!id) return
    setOpen(false)
    setName('')
    selectSpan(id)
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
        <div className="flex flex-col gap-0.5">
          {targets.map((l) => {
            const p = groupPreview(formSpans(l), start, end)
            return (
              <button
                key={l.id}
                disabled={l.locked}
                onClick={() => group({ layerId: l.id })}
                className="flex items-baseline justify-between gap-2 rounded px-2 py-1 text-left hover:bg-accent disabled:opacity-50"
              >
                <span className="truncate text-foreground">
                  {l.label}
                  {l.id === above?.id && <span className="text-muted-foreground"> · just above</span>}
                </span>
                <span className={`shrink-0 text-[11px] ${p.replaced || p.cut ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {l.locked ? 'locked' : effect(p)}
                </span>
              </button>
            )
          })}
        </div>
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
            className="min-w-0 flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className="shrink-0 rounded border border-border px-2 py-0.5 hover:bg-accent">
            Create
          </button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
