// @vitest-environment jsdom
/**
 * Help is a page of its own (docs/decisions.md, "Help Is a Page"): opening it
 * pauses playback, the app's keys stop while it's open, and Esc closes it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HelpDialog } from '@/components/HelpDialog'
import { useUIStore } from '@/store/uiStore'

afterEach(cleanup)

describe('Help', () => {
  it('pauses playback when it opens', () => {
    useUIStore.setState({ playbackState: 'playing', playRequest: null })
    render(<HelpDialog open onOpenChange={() => {}} />)
    expect(useUIStore.getState().playRequest?.play).toBe(false)
    expect(screen.getByRole('dialog', { name: 'How Strata works' })).toBeTruthy()
  })

  it('keeps the app’s keys from reaching it, and closes on Esc', () => {
    const appKey = vi.fn()
    window.addEventListener('keydown', appKey)
    const onOpenChange = vi.fn()
    render(<HelpDialog open onOpenChange={onOpenChange} />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(appKey).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    window.removeEventListener('keydown', appKey)
  })
})
