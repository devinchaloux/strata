// @vitest-environment jsdom
/**
 * Copy and paste between spans: label and type by default, more when chosen,
 * one undo step, never onto the copied span itself.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '@/store/documentStore'
import { copySpans, pasteCheck, pasteOnto, useSpanClipboard } from '@/store/spanClipboard'
import { blockForSpan } from '@/widgets/written-analysis/commentary'
import { formSpans } from '@/lib/layers'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

const store = () => useDocumentStore.getState()
const span = (id: string) => store().document!.layers.flatMap(formSpans).find((s) => s.id === id)!

beforeEach(() => {
  store().loadDocument(
    makeDoc([
      makeLayer('L', [
        makeSpan('a', 0, 10, { label: 'Verse', type: 'verse', annotation: 'tonic', lyrics: 'la la', fillColor: '#efe08a', fillPattern: 'dots' }),
        makeSpan('b', 10, 20),
        makeSpan('c', 20, 30),
        makeSpan('d', 30, 40, { label: 'Chorus', type: 'chorus' }),
        makeSpan('e', 40, 50),
        makeSpan('f', 50, 60),
      ]),
    ]),
  )
  store().setSpanCommentary('a', 'The verse.')
  useDocumentStore.temporal.getState().clear()
  useSpanClipboard.setState({ copied: [], fields: ['label', 'type'] })
})

describe('span copy and paste', () => {
  it('pastes the label and type by default, onto every selected span', () => {
    copySpans(['a'])
    expect(pasteOnto(['b', 'c'])).toBe(2)
    expect(span('b')).toMatchObject({ label: 'Verse', type: 'verse' })
    expect(span('c')).toMatchObject({ label: 'Verse', type: 'verse' })
    expect(span('b').annotation).toBeUndefined()
    expect(span('b').slug).not.toBe(span('a').slug)
  })

  it('pastes more when chosen: annotation, commentary, lyrics, fill and pattern', () => {
    copySpans(['a'])
    pasteOnto(['b'], ['annotation', 'commentary', 'lyrics', 'fill', 'pattern'])
    expect(span('b')).toMatchObject({ annotation: 'tonic', lyrics: 'la la', fillColor: '#efe08a', fillPattern: 'dots' })
    expect(span('b').label).toBeUndefined()
    expect(blockForSpan(store().document!, 'b')?.text).toBe('The verse.')
  })

  it('is one undo step, and skips the copied span itself', () => {
    copySpans(['a'])
    pasteOnto(['a', 'b'], ['label', 'type', 'commentary'])
    expect(useDocumentStore.temporal.getState().pastStates).toHaveLength(1)
    useDocumentStore.temporal.getState().undo()
    expect(span('b').label).toBeUndefined()
  })

  it('does nothing with nothing copied', () => {
    expect(pasteOnto(['b'])).toBe(0)
  })

  it('pastes several copied spans onto as many, paired in time order', () => {
    copySpans(['d', 'a']) // copied in time order whatever the selection order: a, then d
    expect(pasteOnto(['f', 'e'])).toBe(2)
    expect(span('e')).toMatchObject({ label: 'Verse', type: 'verse' })
    expect(span('f')).toMatchObject({ label: 'Chorus', type: 'chorus' })
  })

  it('refuses several onto a different number, and says how many to select', () => {
    copySpans(['a', 'd'])
    expect(pasteOnto(['b', 'c', 'e'])).toBe(0)
    expect(pasteCheck(['b']).reason).toBe('2 spans copied: select 2 to paste them in order.')
    expect(span('b').label).toBeUndefined()
  })
})
