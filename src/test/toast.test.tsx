// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Toast, TOAST_MS } from '@/components/Toast'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { makeDoc, makeLayer } from './fixtures'

afterEach(() => {
  cleanup()
  useUIStore.getState().clearToast()
  vi.useRealTimers()
})

describe('Toast', () => {
  it('names what changed, and Undo takes it back', () => {
    const store = useDocumentStore.getState()
    store.loadDocument(makeDoc([makeLayer('L')]))
    store.updateLayer('L', { label: 'Changed' })
    render(<Toast />)
    act(() => useUIStore.getState().showToast('Renamed the layer'))
    expect(screen.getByRole('status').textContent).toContain('Renamed the layer')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(useDocumentStore.getState().document!.layers[0].label).toBe('L')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('hides itself after a few seconds, and can come without Undo', () => {
    vi.useFakeTimers()
    render(<Toast />)
    act(() => useUIStore.getState().showToast('Nothing to change', { undo: false }))
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
    act(() => vi.advanceTimersByTime(TOAST_MS + 10))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
