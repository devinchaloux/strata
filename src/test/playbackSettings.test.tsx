// @vitest-environment jsdom
/**
 * The ⚙ playback settings: speed presets and a custom speed, the delay, and in
 * the editor the source and the video's place; in an embed, only speed and delay.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaybackSettingsMenu } from '@/components/PlaybackSettingsMenu'
import { useUIStore } from '@/store/uiStore'

afterEach(() => {
  cleanup()
  useUIStore.setState({ playbackRate: 1, listeningDelayOn: false })
})

function open(props: Partial<React.ComponentProps<typeof PlaybackSettingsMenu>> = {}) {
  const onRate = vi.fn()
  render(<PlaybackSettingsMenu ready sourceKind="youtube" onRate={onRate} embed={false} {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Playback settings' }))
  return onRate
}

describe('PlaybackSettingsMenu', () => {
  it('picks a preset speed', () => {
    const onRate = open()
    fireEvent.click(screen.getByRole('button', { name: /^Speed/ }))
    fireEvent.click(screen.getByRole('button', { name: '0.25×' }))
    expect(onRate).toHaveBeenCalledWith(0.25)
  })

  it('takes a typed custom speed, kept inside what YouTube plays', () => {
    const onRate = open()
    fireEvent.click(screen.getByRole('button', { name: /^Speed/ }))
    const field = screen.getByLabelText('Custom speed, typed')
    fireEvent.change(field, { target: { value: '0.1' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onRate).toHaveBeenCalledWith(0.25)
  })

  it('shows a speed other than 1× beside the ⚙', () => {
    useUIStore.setState({ playbackRate: 0.35 })
    render(<PlaybackSettingsMenu ready sourceKind="local" onRate={() => {}} embed={false} />)
    expect(screen.getByRole('button', { name: 'Playback settings' }).textContent).toContain('0.35×')
  })

  it('offers the source and the video place in the editor only', () => {
    const change = vi.fn()
    open({ onChangeSource: change, videoPlacement: { mini: true, toggle: () => {} } })
    expect(screen.getByRole('button', { name: /Video/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change source…' }))
    expect(change).toHaveBeenCalled()
  })

  it('in an embed, holds only speed and delay', () => {
    open({ embed: true })
    expect(screen.queryByRole('button', { name: 'Change source…' })).toBeNull()
    expect(screen.getByRole('button', { name: /Headphone delay/ })).toBeTruthy()
  })
})
