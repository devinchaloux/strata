/**
 * QuickTypeBar — types for the selected spans, right on the diagram.
 *
 * Floats above the diagram, in line with the selection, with the six types that level is likely to need
 * (its own, then the library it draws on; on a lettered level, its letters and
 * the next one), each on a number key, so a piece can be labelled without
 * going to the Inspector. "/" or More… opens the full Type list there. Picking
 * gives every selected span the type, with labels following it as in the
 * Inspector (store/typeActions.ts). docs/decisions.md, "Quick Type".
 *
 * Rendered into document.body so the diagram's clipping never cuts it off,
 * and positioned from the diagram container's box.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { applySpanType } from '@/store/typeActions'
import { formSpans } from '@/lib/layers'
import { shapeTopY, layerBodyHeight } from '@/lib/formShape'
import { quickTypes } from '@/lib/typeSuggestions'
import { isInputFocused } from '@/lib/youtube'
import type { Layer } from '@/types/strata'

const BAR_H = 36
const MAX_OPTIONS = 6

export function QuickTypeBar({
  containerRef,
  layers,
  pps,
  scrollOffset,
}: {
  containerRef: React.RefObject<HTMLDivElement>
  layers: Layer[]
  pps: number
  scrollOffset: number
}) {
  const doc = useDocumentStore((s) => s.document)
  const selected = useUIStore((s) => s.selectedSpanIds)
  const requestTypePicker = useUIStore((s) => s.requestTypePicker)

  // The selection, if it all sits in one visible level.
  const target = useMemo(() => {
    if (!selected.length) return null
    const idx = layers.findIndex((l) => formSpans(l).some((s) => s.id === selected[0]))
    if (idx < 0 || !layers[idx].visibility) return null
    const spans = formSpans(layers[idx]).filter((s) => selected.includes(s.id))
    if (spans.length !== selected.length) return null
    return {
      layer: layers[idx],
      idx,
      start: Math.min(...spans.map((s) => s.startTime)),
      end: Math.max(...spans.map((s) => s.endTime)),
      current: spans.every((s) => s.type === spans[0].type) ? spans[0].type ?? null : null,
    }
  }, [selected, layers])

  const options = useMemo(() => (doc && target ? quickTypes(doc, target.layer.id, MAX_OPTIONS) : []), [doc, target])

  function pick(i: number) {
    const o = options[i]
    if (!o) return
    applySpanType(useUIStore.getState().selectedSpanIds, o.term, o.isNew ? { id: o.term.id, label: o.term.label, kind: 'span' } : undefined)
  }

  // 1–9 pick; "/" opens the full list. Only while the bar shows and no field
  // has the keyboard.
  useEffect(() => {
    if (!target) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isInputFocused()) return
      if (/^[1-9]$/.test(e.key) && options[Number(e.key) - 1]) {
        e.preventDefault()
        pick(Number(e.key) - 1)
      } else if (e.key === '/') {
        e.preventDefault()
        requestTypePicker()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, options, requestTypePicker])

  // Where the container sits on screen; refreshed on scroll and resize.
  const [box, setBox] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || !target) return
    const update = () => setBox(el.getBoundingClientRect())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [containerRef, target, pps, scrollOffset])

  if (!target || !box || !options.length) return null

  // Just above the diagram, in line with the selection, so it never covers
  // the levels or their labels; below the selected level if the diagram is at
  // the top of the window.
  const mid = box.left + ((target.start + target.end) / 2) * pps - scrollOffset
  const above = box.top - BAR_H - 34
  const top = above > 8 ? above : box.top + shapeTopY(layers, target.idx) + layerBodyHeight(target.layer) + 6
  const style: React.CSSProperties = {
    position: 'fixed',
    top,
    left: Math.max(box.left + 4, Math.min(mid, box.right - 4)),
    transform: 'translateX(-50%)',
    height: BAR_H,
    zIndex: 40,
  }

  return createPortal(
    <div
      data-keeps-selection
      role="toolbar"
      aria-label="Quick type"
      style={style}
      className="flex items-center gap-1 rounded-lg border border-border bg-card px-1.5 shadow-md"
    >
      {options.map((o, i) => (
        <button
          key={o.term.id}
          type="button"
          onClick={() => pick(i)}
          title={o.term.definition ?? (o.isNew ? 'The next letter' : o.term.name)}
          aria-pressed={o.term.id === target.current}
          className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[13px] hover:bg-accent ${
            o.isNew
              ? 'border-dashed border-muted-foreground text-muted-foreground'
              : o.term.id === target.current
                ? 'border-foreground font-medium text-foreground'
                : 'border-border text-foreground'
          }`}
        >
          <kbd className="font-sans text-[11px] text-muted-foreground">{i + 1}</kbd>
          {o.isNew ? `+ ${o.term.label}` : o.term.label}
        </button>
      ))}
      <button
        type="button"
        onClick={requestTypePicker}
        title="Every type, with search"
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        More… <kbd className="font-sans text-[11px]">/</kbd>
      </button>
    </div>,
    document.body,
  )
}
