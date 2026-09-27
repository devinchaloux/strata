import { describe, it, expect } from 'vitest'
import { insertAt } from '@/lib/musicSymbols'

describe('insertAt', () => {
  it('inserts at the caret', () => {
    expect(insertAt('pres.  ant.', 6, 6, '⇒')).toEqual({ value: 'pres. ⇒ ant.', caret: 7 })
  })
  it('replaces a selection', () => {
    expect(insertAt('A -> B', 2, 4, '→')).toEqual({ value: 'A → B', caret: 3 })
  })
  it('clamps a stale cursor to the text', () => {
    expect(insertAt('Drop', 10, 12, '′')).toEqual({ value: 'Drop′', caret: 5 })
  })
})
