// @vitest-environment jsdom
/**
 * On a phone Strata reads and plays but doesn't edit (decisions.md, "Read and
 * Play on a Phone"): usePhone follows the window's width, and the reading
 * header there has no Edit.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { usePhone } from '@/hooks/usePhone'
import { ReadingHeader } from '@/components/ReadingHeader'
import { useDocumentStore } from '@/store/documentStore'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

// A stand-in for matchMedia whose answer the test sets.
let narrow = false
const listeners = new Set<() => void>()
function setNarrow(value: boolean) {
  narrow = value
  listeners.forEach((l) => l())
}

beforeEach(() => {
  narrow = false
  listeners.clear()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return narrow
    },
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia
})

afterEach(cleanup)

describe('usePhone', () => {
  it('follows the window between phone width and wider', () => {
    const { result } = renderHook(() => usePhone())
    expect(result.current).toBe(false)
    act(() => setNarrow(true))
    expect(result.current).toBe(true)
    act(() => setNarrow(false))
    expect(result.current).toBe(false)
  })
})

describe('ReadingHeader', () => {
  beforeEach(() => {
    useDocumentStore.getState().loadDocument(makeDoc([makeLayer('L', [makeSpan('a', 0, 30, { label: 'Intro' })])]))
  })

  it('offers Edit on a wide screen', () => {
    render(<ReadingHeader />)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
  })

  it('has no Edit on a phone, and keeps Share and View', () => {
    render(<ReadingHeader phone />)
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()
  })

  it('toggles what the view shows from View, and stays open', async () => {
    const { useUIStore } = await import('@/store/uiStore')
    useUIStore.getState().setReadingShow('diagram', true)
    render(<ReadingHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    const row = screen.getByRole('menuitemcheckbox', { name: 'Segments' })
    expect(row.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(row)
    expect(useUIStore.getState().readingShow.diagram).toBe(false)
    expect(screen.getByRole('menuitemcheckbox', { name: 'Segments' }).getAttribute('aria-checked')).toBe('false')
    // Grid only with a grid; no commentary layer here, so no Commentary row.
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Grid' })).toBeNull()
    expect(screen.getByRole('menuitemcheckbox', { name: 'Color-blind safe' })).toBeTruthy()
  })
})

describe('hiding a layer in the reading view', () => {
  it('hides it from the view only, never in the file', async () => {
    const { withReadingHidden } = await import('@/lib/layers')
    const { useUIStore } = await import('@/store/uiStore')
    const doc = makeDoc([makeLayer('A', []), makeLayer('B', [])])
    useUIStore.getState().setReadingLayerHidden('B', true)
    const shown = withReadingHidden(doc, useUIStore.getState().readingHiddenLayers)
    expect(shown.layers.map((l) => l.visibility)).toEqual([true, false])
    expect(doc.layers.map((l) => l.visibility)).toEqual([true, true])
    useUIStore.getState().setReadingLayerHidden('B', false)
    expect(useUIStore.getState().readingHiddenLayers).toEqual([])
  })
})
