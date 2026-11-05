import { describe, it, expect } from 'vitest'
import { useUIStore } from '@/store/uiStore'

describe('switching to the reading view', () => {
  it('closes an open commentary editor, so the stack follows playback', () => {
    useUIStore.getState().setCommentaryEdit({ key: 'span:abc', at: 17 })
    useUIStore.getState().setReadingView(true)
    expect(useUIStore.getState().commentaryEdit).toBeNull()
    useUIStore.getState().setReadingView(false)
  })
})
