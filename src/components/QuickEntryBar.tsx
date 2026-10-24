/**
 * QuickEntryBar — quick entry for the selected spans, right on the diagram.
 *
 * Floats just above the diagram, in line with the selection, and offers one
 * thing at a time on number keys, chosen by the Quick pick menu in the
 * diagram's top bar (uiStore.quickEntry):
 *   - Type: the layer's own types, then its library's (chosen here, saved as
 *     Layer.library, or guessed); on a lettered layer its letters and the next
 *     one. "/" or More… opens the full Type list. Hidden once every selected
 *     span has a type, so it never nags. With nothing to offer yet (a new
 *     file, no library), it shows the library chooser and More… alone.
 *   - Shape: drawn, in groups: the whole shape (1–3) and the line, solid or
 *     dashed (4–5), on number keys; then each end on its own, by click.
 *   - Fill: the layer default and eight muted colours (lib/palette.ts).
 *   Shape and Fill end with More…, which opens the Inspector's Shape & color
 *   tab (with the Fill picker open, for fills), as Type's opens the Type list.
 * Picking applies to every selected span in one undo step, with labels
 * following a new type as in the Inspector (store/typeActions.ts).
 * docs/decisions.md, "Quick Entry".
 *
 * Rendered into document.body so the diagram's clipping never cuts it off,
 * kept inside the window, and stops its clicks from reaching the diagram
 * (whose click clears the selection: React events bubble through portals).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { applySpanType } from '@/store/typeActions'
import { formSpans } from '@/lib/layers'
import { capFromBoundaryType, shapeTopY, layerBodyHeight } from '@/lib/formShape'
import { quickTypes } from '@/lib/typeSuggestions'
import { LIBRARIES } from '@/lib/vocabulary'
import { isInputFocused } from '@/lib/youtube'
import type { Layer, Span } from '@/types/strata'
import { CAP_ICONS, WHOLE_ICONS } from '@/lib/capIcons'
import { QUICK_FILLS, safeFill } from '@/lib/palette'

const BAR_H = 36
const MAX_TYPES = 8
const EDGE = 8 // keep this far inside the window

type Option = {
  key: string
  label: string
  title?: string
  swatch?: string
  /** A picture instead of (or beside) the label: the Shapes options. */
  icon?: React.ReactNode
  /** Shapes are shown in groups (Whole, Line, Start, End). */
  group?: string
  /** The number key that picks it; types and fills number every option in order. */
  hotkey?: number
  isNew?: boolean
  on?: boolean
  apply: () => void
}

/** A bracket picture for the Shapes options; `dashed` draws the line dashed. */
function ShapeIcon({ d, n, bx, dashed }: { d: string; n?: string; bx?: number; dashed?: boolean }) {
  return (
    <svg width="30" height="17" viewBox="0 0 40 22" aria-hidden>
      {bx != null && <line x1={bx} y1={0} x2={bx} y2={22} stroke="var(--hairline)" strokeDasharray="2 2" />}
      {n && <path d={n} fill="none" stroke="var(--ink-muted)" strokeWidth={1.5} strokeLinejoin="round" />}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={dashed ? '5 3' : undefined}
      />
    </svg>
  )
}

/** One value shared by every selected span, else null (mixed). */
function shared<T>(spans: Span[], get: (s: Span) => T): T | null {
  const first = get(spans[0])
  return spans.every((s) => get(s) === first) ? first : null
}


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
  // Swatches as the diagram draws them (the colour-blind safe switch).
  const colorblindSafe = useUIStore((s) => s.colorblindSafe)
  const shown = (c: string) => (colorblindSafe ? safeFill(c) : c)
  const requestTypePicker = useUIStore((s) => s.requestTypePicker)
  const requestFillPicker = useUIStore((s) => s.requestFillPicker)
  const setInspectorTab = useUIStore((s) => s.setInspectorTab)
  // More… (or "/"): the full list in the Inspector for whatever this offers.
  const more = useCallback(() => {
    if (mode === 'type') requestTypePicker()
    else if (mode === 'fill') requestFillPicker()
    else setInspectorTab('shape')
  }, [mode, requestTypePicker, requestFillPicker, setInspectorTab])
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
      return quickTypes(doc, target.layer.id, MAX_TYPES).map((o, i) => ({
        key: o.term.id,
        hotkey: i + 1,
        label: o.isNew ? `+ ${o.term.label}` : o.term.label,
        title: o.term.definition ?? (o.isNew ? 'The next letter' : o.term.name),
        isNew: o.isNew,
        on: o.term.id === target.current,
        apply: () => applySpanType(ids, o.term, o.isNew ? { id: o.term.id, label: o.term.label, kind: 'span' } : undefined),
      }))
    }
    if (mode === 'shape') {
      // Whole shape and line on number keys (1–3, 4–5); each end by click.
      const update = (patch: (s: Span) => Partial<Span>) => () =>
        withHistoryGroup(newGestureKey('quick-shape'), () => {
          for (const s of target.spans) useDocumentStore.getState().updateSpan(target.layer.id, s.id, patch(s))
        })
      const startCap = shared(target.spans, (s) => s.startCap ?? capFromBoundaryType(s.startBoundaryType))
      const endCap = shared(target.spans, (s) => s.endCap ?? capFromBoundaryType(s.endBoundaryType))
      const dashed = shared(target.spans, (s) => s.lineStyle === 'dashed')
      const whole: Option[] = WHOLE_ICONS.map((o, i) => ({
        key: `whole-${o.cap}`,
        label: o.name,
        title: `${o.name}, both ends`,
        group: 'Whole',
        hotkey: i + 1,
        icon: <ShapeIcon d={o.d} />,
        on: startCap === o.cap && endCap === o.cap,
        apply: update(() => ({ startCap: o.cap, endCap: o.cap })),
      }))
      const square = WHOLE_ICONS.find((o) => o.cap === 'square')!.d
      const line: Option[] = [
        { key: 'solid', label: 'Solid', title: 'Solid line', group: 'Line', hotkey: 4, icon: <ShapeIcon d={square} />, on: dashed === false, apply: update(() => ({ lineStyle: undefined })) },
        { key: 'dashed', label: 'Dashed', title: 'Dashed line', group: 'Line', hotkey: 5, icon: <ShapeIcon d={square} dashed />, on: dashed === true, apply: update(() => ({ lineStyle: 'dashed' })) },
      ]
      const ends = (side: 'start' | 'end'): Option[] =>
        CAP_ICONS[side].map((o) => ({
          key: `${side}-${o.cap}`,
          label: o.name,
          title: `${o.name} ${side}`,
          group: side === 'start' ? 'Start' : 'End',
          icon: <ShapeIcon d={o.d} n={o.n} bx={o.bx} />,
          on: (side === 'start' ? startCap : endCap) === o.cap,
          apply: update(() => (side === 'start' ? { startCap: o.cap } : { endCap: o.cap })),
        }))
      return [...whole, ...line, ...ends('start'), ...ends('end')]
    }
    return [
      { key: 'default', label: 'Layer default', hotkey: 1, swatch: target.layer.fillColorDefault, apply: () => updateSpans(ids, { fillColor: null }) },
      ...QUICK_FILLS.map((c, i) => ({ key: c, label: '', title: c, hotkey: i + 2, swatch: c, apply: () => updateSpans(ids, { fillColor: c }) })),
    ]
  }, [doc, target, mode])

  // Types show even with nothing to offer yet (a new file, no library chosen):
  // the bar is where the library is chosen, and More… opens every type.
  const showing = !!target && (options.length > 0 || (mode === 'type' && !target.allTyped))

  // 1–9 pick; "/" opens the full Type list. Only while the bar shows and no
  // field has the keyboard.
  useEffect(() => {
    if (!showing) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isInputFocused() || document.activeElement instanceof HTMLSelectElement) return
      const picked = /^[1-9]$/.test(e.key) ? options.find((o) => o.hotkey === Number(e.key)) : undefined
      if (picked) {
        e.preventDefault()
        picked.apply()
      } else if (e.key === '/') {
        e.preventDefault()
        more()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showing, options, more])

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

  if (!target || !box || !showing) return null

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
      aria-label="Quick pick"
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
          <option value="">{options.length ? 'Library: guess' : 'Choose a library…'}</option>
          {LIBRARIES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      )}
      {mode === 'type' && !options.length && (
        <span className="px-1 text-xs text-muted-foreground">for one-click types, or</span>
      )}
      {options.map((o, i) => (
        <span key={o.key} className="flex items-center gap-1">
          {/* A group's label, before its first option (Shapes). */}
          {o.group && o.group !== options[i - 1]?.group && (
            <span className={`text-[11px] text-muted-foreground ${i > 0 ? 'ml-1.5 border-l border-border pl-2' : 'pl-0.5'}`}>{o.group}</span>
          )}
          <button
            type="button"
            onClick={o.apply}
            title={o.title ?? o.label}
            aria-label={o.title ?? o.label}
            aria-pressed={o.on}
            className={`flex h-7 items-center gap-1.5 rounded-md border hover:bg-accent ${o.icon ? 'px-1' : 'px-2'} text-[13px] ${
              o.isNew ? 'border-dashed border-muted-foreground text-muted-foreground' : o.on ? 'border-foreground font-medium text-foreground' : 'border-border text-foreground'
            }`}
          >
            {o.hotkey != null && <kbd className="font-sans text-[11px] text-muted-foreground">{o.hotkey}</kbd>}
            {o.swatch && <span className="h-4 w-4 rounded border border-border" style={{ background: shown(o.swatch) }} aria-hidden />}
            {o.icon ?? o.label}
          </button>
        </span>
      ))}
      {mode !== 'off' && (
        <button
          type="button"
          onClick={more}
          title={mode === 'type' ? 'Every type, with search' : mode === 'fill' ? 'Every colour' : 'Every shape setting, in the Inspector'}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          More… <kbd className="font-sans text-[11px]">/</kbd>
        </button>
      )}
    </div>,
    document.body,
  )
}
