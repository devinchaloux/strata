import { describe, it, expect } from 'vitest'
import { hasLyrics, rawFileUrl, shareUrl, srcParam, withoutLyrics } from '@/lib/shareLink'
import { formSpans } from '@/lib/layers'
import { makeDoc, makeLayer, makeSpan } from './fixtures'

describe('share links', () => {
  it('carry the file address and read it back', () => {
    const link = shareUrl('https://example.org/a b.strata', 'https://strata.app/?x=1#h')
    expect(link).toBe('https://strata.app/?src=https%3A%2F%2Fexample.org%2Fa+b.strata')
    expect(srcParam(link)).toBe('https://example.org/a%20b.strata')
  })

  it('accept only web addresses', () => {
    expect(srcParam('https://strata.app/?src=javascript:alert(1)')).toBeNull()
    expect(srcParam('https://strata.app/')).toBeNull()
  })

  it('turn a GitHub page link into the raw file', () => {
    expect(rawFileUrl('https://github.com/me/notes/blob/main/alive.strata')).toBe('https://raw.githubusercontent.com/me/notes/main/alive.strata')
    expect(rawFileUrl('https://example.org/a.strata')).toBe('https://example.org/a.strata')
  })

  it('can leave lyrics out of a copy', () => {
    const doc = makeDoc([makeLayer('L', [makeSpan('a', 0, 10, { lyrics: 'words' }), makeSpan('b', 10, 20)])])
    expect(hasLyrics(doc)).toBe(true)
    const copy = withoutLyrics(doc)
    expect(hasLyrics(copy)).toBe(false)
    expect(formSpans(copy.layers[0]).map((s) => s.id)).toEqual(['a', 'b'])
    expect(hasLyrics(doc)).toBe(true) // the original is untouched
  })
})
