/**
 * QuickEntryBar — quick entry for the selected spans, right on the diagram.
 *
 * Floats just above the diagram, in line with the selection, and offers one
 * thing at a time on number keys, chosen by the Quick entry switch in the
 * diagram's top bar (uiStore.quickEntry):
 *   - Type: the layer's own types, then its library's (chosen here, saved as
 *     Layer.library, or guessed); on a lettered layer its letters and the next
 *     one. "/" or More… opens the full Type list. Hidden once every selected
 *     span has a type, so it never nags.
 *   - Shape: each end's shape and the line, as in the Inspector's Shape tab.
 *   - Fill: the layer default and eight colours.
 * Picking applies to every selected span in one undo step, with labels
 * following a new type as in the Inspector (store/typeActions.ts).
 * docs/decisions.md, "Quick Entry".
 *
 * Rendered into document.body so the diagram's clipping never cuts it off,
 * kept inside the window, and stops its clicks from reaching the diagram
 * (whose click clears the selection: React events bubble through portals).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { applySpanType } from '@/store/typeActions'
import { formSpans } from '@/lib/layers'
import { shapeTopY, layerBodyHeight } from '@/lib/formShape'
import { quickTypes } from '@/lib/typeSuggestions'
import { LIBRARIES } from '@/lib/vocabulary'
import { isInputFocused } from '@/lib/youtube'
import type { CapStyle, Layer, Span } from '@/types/strata'

const BAR_H = 36
const MAX_TYPES = 8
const EDGE = 8 // keep this far inside the window

type Option = { key: string; label: string; title?: string; swatch?: string; isNew?: boolean; on?: boolean; apply: () => void }

const SHAPES: { label: string; patch: (s: Span) => Partial<Span> }[] = [
  { label: 'Rounded', patch: () => ({ startCap: 'rounded', endCap: 'rounded' }) },
  { label: 'Square', patch: () => ({ startCap: 'square', endCap: 'square' }) },
  { label: 'Angled', patch: () => ({ startCap: 'angled', endCap: 'angled' }) },
  { label: 'Open start', patch: () => ({ startCap: 'open' as CapStyle }) },
  { label: 'Open end', patch: () => ({ endCap: 'open' as CapStyle }) },
  { label: 'Elided start', patch: () => ({ startCap: 'elision' as CapStyle }) },
  { label: 'Elided end', patch: () => ({ endCap: 'elision' as CapStyle }) },
  { label: 'Dashed line', patch: (s) => ({ lineStyle: s.lineStyle === 'dashed' ? 'solid' : 'dashed' }) },
]

const FILLS = ['#94a3b8', '#22c55e', '#3b82f6', '#06b6d4', '#8b5cf6', '#14b8a6', '#ec4899', '#f97316']

export function QuickEntryBar({
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
  const updateLayer = useDocumentStore((s) => s.updateLayer)
  const selected = useUIStore((s) => s.selectedSpanIds)
  const mode = useUIStore((s) => s.quickEntry)
  const requestTypePicker = useUIStore((s) => s.requestTypePicker)
  const barRef = useRef<HTMLDivElement>(null)

  // The selection, if it all sits in one visible layer.
  const target = useMemo(() => {
    if (!selected.length) return null
    const idx = layers.findIndex((l) => formSpans(l).some((s) => s.id === selected[0]))
    if (idx < 0 || !layers[idx].visibility) return null
    const spans = formSpans(layers[idx]).filter((s) => selected.includes(s.id))
    if (spans.length !== selected.length) return null
    return {
      layer: layers[idx],
      idx,
      spans,
      start: Math.min(...spans.map((s) => s.startTime)),
      end: Math.max(...spans.map((s) => s.endTime)),
      current: spans.every((s) => s.type === spans[0].type) ? spans[0].type ?? null : null,
      allTyped: spans.every((s) => !!s.type),
    }
  }, [selected, layers])

  const options: Option[] = useMemo(() => {
    if (!doc || !target || mode === 'off') return []
    const ids = target.spans.map((s) => s.id)
    const updateSpans = useDocumentStore.getState().updateSpans
    if (mode === 'type') {
      if (target.allTyped) return []
      return quickTypes(doc, target.layer.id, MAX_TYPES).map((o) => ({
        key: o.term.id,
        label: o.isNew ? `+ ${o.term.label}` : o.term.label,
        title: o.term.definition ?? (o.isNew ? 'The next letter' : o.term.name),
        isNew: o.isNew,
        on: o.term.id === target.current,
        apply: () => applySpanType(ids, o.term, o.isNew ? { id: o.term.id, label: o.term.label, kind: 'span' } : undefined),
      }))
    }
    if (mode === 'shape')
      return SHAPES.map((sh) => ({
        key: sh.label,
        label: sh.label,
        apply: () =>
          withHistoryGroup(newGestureKey('quick-shape'), () => {
            for (const s of target.spans) useDocumentStore.getState().updateSpan(target.layer.id, s.id, sh.patch(s))
          }),
      }))
    return [
      { key: 'default', label: 'Layer default', swatch: target.layer.fillColorDefault, apply: () => updateSpans(ids, { fillColor: null }) },
      ...FILLS.map((c) => ({ key: c, label: '', title: c, swatch: c, apply: () => updateSpans(ids, { fillColor: c }) })),
    ]
  }, [doc, target, mode])

  // 1–9 pick; "/" opens the full Type list. Only while the bar shows and no
  // field has the keyboard.
  useEffect(() => {
    if (!options.length) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isInputFocused() || document.activeElement instanceof HTMLSelectElement) return
      if (/^[1-9]$/.test(e.key) && options[Number(e.key) - 1]) {
        e.preventDefault()
        options[Number(e.key) - 1].apply()
      } else if (e.key === '/' && mode === 'type') {
        e.preventDefault()
        requestTypePicker()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [options, mode, requestTypePicker])

  // Where the container sits on screen, and the bar's own width (to keep it
  // inside the window); refreshed on scroll and resize.
  const [box, setBox] = useState<DOMRect | null>(null)
  const [width, setWidth] = useState(0)
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
  useLayoutEffect(() => {
    if (barRef.current) setWidth(barRef.current.offsetWidth)
  }, [options, box])

  if (!target || !box || !options.length) return null

  // Just above the diagram, centred on the selection but kept inside the
  // window; below the selected layer if the diagram is at the top.
  const mid = box.left + ((target.start + target.end) / 2) * pps - scrollOffset
  const half = width / 2
  const left = Math.max(EDGE + half, Math.min(mid, window.innerWidth - EDGE - half))
  const above = box.top - BAR_H - 34
  const top = above > EDGE ? above : box.top + shapeTopY(layers, target.idx) + layerBodyHeight(target.layer) + 6
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  return createPortal(
    <div
      ref={barRef}
      data-keeps-selection
      role="toolbar"
      aria-label="Quick entry"
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      style={{ position: 'fixed', top, left, transform: 'translateX(-50%)', height: BAR_H, zIndex: 40 }}
      className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-card px-1.5 shadow-md"
    >
      {mode === 'type' && (
        <select
          aria-label="Library for this layer"
          title="Where this layer's quick types come from"
          className="h-7 max-w-36 rounded-md border border-border bg-muted px-1 text-xs text-foreground"
          value={target.layer.library ?? ''}
          onChange={(e) => {
            updateLayer(target.layer.id, { library: e.target.value || null })
            e.currentTarget.blur()
          }}
        >
          <option value="">Library: guess</option>
          {LIBRARIES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      )}
      {options.map((o, i) => (
        <button
          key={o.key}
          type="button"
          onClick={o.apply}
          title={o.title ?? o.label}
          aria-label={o.label || o.title}
          aria-pressed={o.on}
          className={`flex h-7 items-center gap-1.5 rounded-md border px-2 text-[13px] hover:bg-accent ${
            o.isNew ? 'border-dashed border-muted-foreground text-muted-foreground' : o.on ? 'border-foreground font-medium text-foreground' : 'border-border text-foreground'
          }`}
        >
          <kbd className="font-sans text-[11px] text-muted-foreground">{i + 1}</kbd>
          {o.swatch && <span className="h-4 w-4 rounded border border-border" style={{ background: o.swatch }} aria-hidden />}
          {o.label}
        </button>
      ))}
      {mode === 'type' && (
        <button
          type="button"
          onClick={requestTypePicker}
          title="Every type, with search"
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          More… <kbd className="font-sans text-[11px]">/</kbd>
        </button>
      )}
    </div>,
    document.body,
  )
}
