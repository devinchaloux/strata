/**
 * The commentary editor's formatting: wrapping a selection in Markdown marks
 * and toggling line marks.
 */
import { describe, it, expect } from 'vitest'
import { toggleWrap, toggleLinePrefix, replaceSelection } from '@/lib/textEdit'

describe('toggleWrap', () => {
  it('wraps the selection, keeping it selected', () => {
    expect(toggleWrap('a loud drop', 2, 6, '**')).toEqual({ text: 'a **loud** drop', start: 4, end: 8 })
  })

  it('unwraps when the marks sit just outside the selection', () => {
    expect(toggleWrap('a **loud** drop', 4, 8, '**')).toEqual({ text: 'a loud drop', start: 2, end: 6 })
  })

  it('unwraps when the marks are selected too', () => {
    expect(toggleWrap('a *soft* end', 2, 8, '*')).toEqual({ text: 'a soft end', start: 2, end: 6 })
  })

  it('leaves bold alone when toggling italic inside it', () => {
    expect(toggleWrap('**loud**', 2, 6, '*').text).toBe('***loud***')
  })

  it('puts the cursor between the marks with nothing selected', () => {
    expect(toggleWrap('ab', 1, 1, '*')).toEqual({ text: 'a**b', start: 2, end: 2 })
  })
})

describe('toggleLinePrefix', () => {
  const text = 'first\nsecond\nthird'

  it('marks every line the selection touches', () => {
    expect(toggleLinePrefix(text, 2, 9, 'bullet').text).toBe('- first\n- second\nthird')
  })

  it('numbers lines from 1', () => {
    expect(toggleLinePrefix(text, 0, text.length, 'number').text).toBe('1. first\n2. second\n3. third')
  })

  it('takes the mark off when every line has it', () => {
    expect(toggleLinePrefix('> a\n> b', 0, 7, 'quote').text).toBe('a\nb')
  })

  it('swaps one line mark for another', () => {
    expect(toggleLinePrefix('- a', 0, 0, 'heading').text).toBe('## a')
  })

  it('ignores the line after a selection that ends on a line break', () => {
    expect(toggleLinePrefix(text, 0, 6, 'bullet').text).toBe('- first\nsecond\nthird')
  })
})

describe('replaceSelection', () => {
  it('puts the cursor after what goes in', () => {
    expect(replaceSelection('see X here', 4, 5, '[[drop]]')).toEqual({ text: 'see [[drop]] here', start: 12, end: 12 })
  })
})
