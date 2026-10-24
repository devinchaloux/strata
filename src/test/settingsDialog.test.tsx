// @vitest-environment jsdom
/**
 * The New analysis dialog keeps everything past title, artist, source, tempo
 * and meter behind "Advanced" — unless a link has already filled some of it
 * in, which the analyst should see before pressing Start.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DocumentSettingsDialog } from '@/components/DocumentSettingsDialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useDocumentStore } from '@/store/documentStore'
import { createEmptyDocument } from '@/lib/fileIO'
import { applyNewFromLink, parseNewParams } from '@/lib/newFromLink'

function open() {
  render(
    <TooltipProvider>
      <DocumentSettingsDialog open onOpenChange={() => {}} isNew />
    </TooltipProvider>,
  )
}

afterEach(cleanup)

describe('New analysis dialog', () => {
  it('keeps the advanced settings folded for a blank new analysis', () => {
    useDocumentStore.getState().loadDocument(createEmptyDocument())
    open()
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('textbox', { name: 'Tempo (BPM)' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Analysis author' })).toBeNull()
  })

  it('unfolds them when a link filled in the key or author', () => {
    const n = parseNewParams('https://strata.devinchaloux.com/?new&title=Alive&bpm=128&author=A.%20Analyst')!
    useDocumentStore.getState().loadDocument(applyNewFromLink(createEmptyDocument(), n))
    open()
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByDisplayValue('128')).toBeTruthy()
    expect(screen.getByDisplayValue('A. Analyst')).toBeTruthy()
  })

  it('keeps a tempo being typed when the media’s length arrives', () => {
    useDocumentStore.getState().loadDocument(createEmptyDocument())
    open()
    const tempo = screen.getByRole('textbox', { name: 'Tempo (BPM)' })
    fireEvent.change(tempo, { target: { value: '128' } })
    act(() => useDocumentStore.getState().updateMeta({ duration: 285 }))
    expect((screen.getByRole('textbox', { name: 'Tempo (BPM)' }) as HTMLInputElement).value).toBe('128')
  })

  it('opens Document settings with Advanced folded too', () => {
    useDocumentStore.getState().loadDocument(createEmptyDocument())
    render(
      <TooltipProvider>
        <DocumentSettingsDialog open onOpenChange={() => {}} />
      </TooltipProvider>,
    )
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false')
  })
})
