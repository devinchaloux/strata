/**
 * The New analysis dialog keeps everything past title, artist and source behind
 * "More details" — unless a link has already filled some of it in, which the
 * analyst should see before pressing Start.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
  it('keeps the details folded for a blank new analysis', () => {
    useDocumentStore.getState().loadDocument(createEmptyDocument())
    open()
    expect(screen.getByRole('button', { name: /More details/ })).toBeTruthy()
  })

  it('shows them when a link filled in the tempo, key or author', () => {
    const n = parseNewParams('https://strata.devinchaloux.com/?new&title=Alive&bpm=128&author=A.%20Analyst')!
    useDocumentStore.getState().loadDocument(applyNewFromLink(createEmptyDocument(), n))
    open()
    expect(screen.queryByRole('button', { name: /More details/ })).toBeNull()
    expect(screen.getByDisplayValue('128')).toBeTruthy()
    expect(screen.getByDisplayValue('A. Analyst')).toBeTruthy()
  })
})
