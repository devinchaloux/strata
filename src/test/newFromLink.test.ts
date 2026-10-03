import { describe, it, expect } from 'vitest'
import { applyNewFromLink, parseNewParams } from '@/lib/newFromLink'
import { createEmptyDocument } from '@/lib/fileIO'

const BASE = 'https://strata.devinchaloux.com/'

describe('parseNewParams', () => {
  it('is null for an address that is not a new-analysis link', () => {
    expect(parseNewParams(BASE)).toBeNull()
    expect(parseNewParams(`${BASE}?src=https://example.com/a.strata`)).toBeNull()
  })

  it('reads every field', () => {
    const url = `${BASE}?new&title=Alive&artist=Krewella&video=${encodeURIComponent('https://youtu.be/hPpK_GkAK30?si=x')}&bpm=128&key=A&mode=minor&author=${encodeURIComponent('A. Analyst')}`
    expect(parseNewParams(url)).toEqual({
      title: 'Alive',
      artist: ['Krewella'],
      video: 'https://www.youtube.com/watch?v=hPpK_GkAK30',
      bpm: 128,
      homeKey: { tonic: 'A', mode: 'minor' },
      author: 'A. Analyst',
    })
  })

  it('keeps several artists in order, and writes sharps and flats as symbols', () => {
    const n = parseNewParams(`${BASE}?new&artist=Avicii&artist=${encodeURIComponent('Aloe Blacc')}&key=${encodeURIComponent('F#')}`)!
    expect(n.artist).toEqual(['Avicii', 'Aloe Blacc'])
    expect(n.homeKey).toEqual({ tonic: 'F♯', mode: null })
  })

  it('leaves out what does not read, rather than refusing the link', () => {
    const n = parseNewParams(`${BASE}?new&title=X&video=nope&bpm=0&mode=sideways`)!
    expect(n).toEqual({ title: 'X', artist: [] })
  })
})

describe('applyNewFromLink', () => {
  it('fills a new document, leaving the rest as a new one has it', () => {
    const doc = applyNewFromLink(createEmptyDocument(), parseNewParams(`${BASE}?new&title=Alive&artist=Krewella&video=hPpK_GkAK30&bpm=128`)!)
    expect(doc.title).toBe('Alive')
    expect(doc.artist).toEqual(['Krewella'])
    expect(doc.source).toMatchObject({ type: 'youtube', url: 'https://www.youtube.com/watch?v=hPpK_GkAK30', sourceOffset: 0 })
    expect(doc.bpm).toBe(128)
    expect(doc.homeKey).toBeUndefined()
    expect(doc.analysisAuthor).toBeUndefined()
    expect(applyNewFromLink(createEmptyDocument(), { artist: [], author: 'A. Analyst' }).analysisAuthor).toBe('A. Analyst')
    expect(doc.layers).toHaveLength(1)
  })
})
