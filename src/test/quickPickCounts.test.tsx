// @vitest-environment jsdom
/**
 * Quick pick on the bar layer (components/QuickEntryBar.tsx): counts, not
 * section types (docs/decisions.md, "UI Review: the Layer Menu Folds, Quick
 * Pick Counts Bars").
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { QuickEntryBar } from '@/components/QuickEntryBar'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { segmentSpans } from '@/lib/layers'
import { hypermeterText } from '@/lib/hypermeter'
import type { Span } from '@/types/strata'
import { makeDoc, makeLayer } from './fixtures'

const bars: Span[] = Array.from({ length: 4 }, (_, k) => ({ id: `b${k}`, startTime: k * 2, endTime: k * 2 + 2, hypermeter: { count: k + 1 } }))

function show(layerRole?: 'bars') {
  useDocumentStore.getState().loadDocument({ ...makeDoc([{ ...makeLayer('L', bars), ...(layerRole ? { role: layerRole } : {}) }]), duration: 8 })
  useUIStore.getState().setQuickEntry('type')
  const ref = createRef<HTMLDivElement>()
  render(
    <div ref={ref}>
      <QuickEntryBar containerRef={ref} layers={useDocumentStore.getState().document!.layers} pps={10} scrollOffset={0} />
    </div>,
  )
}
const counts = () => segmentSpans(useDocumentStore.getState().document!.layers[0]).map((s) => hypermeterText(s.hypermeter) || null)
const select = (...ids: string[]) => act(() => useUIStore.getState().setSelection(ids, ids[0]))

describe('Quick pick on the bar layer', () => {
  beforeEach(() => useUIStore.getState().setSelection([], null))
  afterEach(cleanup)

  it('offers counts, "=1" and None, not types or a library', () => {
    show('bars')
    select('b3')
    const bar = screen.getByRole('toolbar', { name: 'Quick pick' })
    const names = [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))
    expect(names.slice(0, 10)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '=1', 'None'])
    expect(bar.querySelector('select')).toBeNull()
  })

  it('sets a count on every selected bar from a number key, and elides with "="', () => {
    show('bars')
    select('b1', 'b2')
    fireEvent.keyDown(window, { key: '3' })
    expect(counts()).toEqual(['1', '3', '3', '4'])
    select('b1')
    fireEvent.keyDown(window, { key: '=' })
    expect(counts()).toEqual(['1', '2=1', '2', '3'])
  })

  it('offers types on any other layer', () => {
    show()
    select('b1')
    expect(screen.getByRole('combobox', { name: 'Library for this layer' })).toBeTruthy()
  })
})
