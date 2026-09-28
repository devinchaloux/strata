/**
 * Interaction test: a real boundary drag through FormLayers produces exactly one
 * undo step. The store-level history tests prove the grouping mechanism; this
 * proves the component actually uses it — the gap the pure-function tests left.
 */
import { formSpans } from '@/lib/layers'
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { FormLayers } from '@/components/FormLayers'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

// jsdom has no PointerEvent; a MouseEvent with the pointer type name carries
// clientX, which is all the drag handlers read.
function pointer(target: EventTarget, type: string, clientX: number) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX }))
}

describe('FormLayers boundary drag', () => {
  beforeEach(() => {
    useDocumentStore.getState().loadDocument(makeDoc([makeLayer('L', [makeSpan('a', 0, 50), makeSpan('b', 50, 100)])]))
    useDocumentStore.temporal.getState().clear()
    useUIStore.setState({ zoom: 1, scrollOffset: 0, viewportWidth: 1000 })
  })

  it('records one undo step for a whole drag', () => {
    const { container } = render(<FormLayers layers={useDocumentStore.getState().document!.layers} />)
    const handle = container.querySelector('[style*="ew-resize"]')!
    expect(handle).not.toBeNull()

    const startX = 50 * 10 // 100% zoom = 10 px per second, so the boundary is at 500px
    pointer(handle, 'pointerdown', startX)
    for (let dx = 5; dx <= 50; dx += 5) pointer(window, 'pointermove', startX + dx)
    pointer(window, 'pointerup', startX + 50)

    const spans = formSpans(useDocumentStore.getState().document!.layers[0])
    expect(spans[0].endTime).toBeCloseTo(55)
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(1)
  })
})
