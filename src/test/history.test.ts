import { formSpans } from '@/lib/layers'
import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '@/store/documentStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const store = () => useDocumentStore.getState()
const steps = () => useDocumentStore.temporal.getState().pastStates.length
const boundary = () => formSpans(store().document!.layers[0])[0].endTime

function load() {
  store().loadDocument(
    makeDoc([makeLayer('L', [makeSpan('a', 0, 50), makeSpan('b', 50, 100)])]),
  )
  useDocumentStore.temporal.getState().clear()
}

/** Simulates one drag: many writes under one gesture key. */
function drag(to: number[]) {
  const key = newGestureKey('test-drag')
  for (const t of to) withHistoryGroup(key, () => store().setAdjacentBoundary('L', 'a', 'b', t))
}

describe('undo history grouping', () => {
  beforeEach(load)

  it('records one step for a whole drag, and undo restores the pre-drag state', () => {
    drag([51, 52, 53, 54, 60])
    expect(boundary()).toBe(60)
    expect(steps()).toBe(1)
    useDocumentStore.temporal.getState().undo()
    expect(boundary()).toBe(50)
  })

  it('keeps two separate drags as two steps', () => {
    drag([55, 56])
    drag([70, 71])
    expect(steps()).toBe(2)
  })

  it('starts a new step after undo even with a matching key', () => {
    const key = newGestureKey('test-drag')
    withHistoryGroup(key, () => store().setAdjacentBoundary('L', 'a', 'b', 60))
    useDocumentStore.temporal.getState().undo()
    withHistoryGroup(key, () => store().setAdjacentBoundary('L', 'a', 'b', 70))
    expect(steps()).toBe(1)
    expect(boundary()).toBe(70)
  })

  it('does not record an undo step for saving', () => {
    store().markSaved()
    expect(steps()).toBe(0)
  })

  it('records ungrouped writes as separate steps', () => {
    store().updateSpan('L', 'a', { label: 'x' })
    store().updateSpan('L', 'a', { label: 'y' })
    expect(steps()).toBe(2)
  })
})

describe('text field grouping', () => {
  beforeEach(load)

  /** A native text input whose input handler writes the label — as React's onChange does. */
  function field(): HTMLInputElement {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.addEventListener('input', () => store().updateSpan('L', 'a', { label: input.value }))
    return input
  }

  function type(input: HTMLInputElement, text: string) {
    for (const ch of text) {
      input.value += ch
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  it('collapses typing within one focus session into one step', () => {
    const input = field()
    input.focus()
    type(input, 'Chorus')
    expect(formSpans(store().document!.layers[0])[0].label).toBe('Chorus')
    expect(steps()).toBe(1)
  })

  it('makes a new step when the field is focused again', () => {
    const input = field()
    input.focus()
    type(input, 'Ch')
    input.blur()
    input.focus()
    type(input, 'orus')
    expect(steps()).toBe(2)
  })
})
