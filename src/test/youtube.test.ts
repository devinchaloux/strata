import { describe, it, expect } from 'vitest'
import {
  extractVideoId,
  parseYouTubeInput,
  canonicalYouTubeUrl,
  isValidVideoId,
} from '@/lib/youtube'

// The canonical demo video ID (Krewella — "Alive"): 11 chars, mixed case + underscore.
const ID = '_ovdm2yX4MA'

describe('isValidVideoId', () => {
  it('accepts an 11-char [A-Za-z0-9_-] id', () => {
    expect(isValidVideoId(ID)).toBe(true)
    expect(isValidVideoId('abc-DEF_123')).toBe(true)
  })

  it('rejects wrong lengths and bad characters', () => {
    expect(isValidVideoId('')).toBe(false)
    expect(isValidVideoId('short')).toBe(false)
    expect(isValidVideoId('twelvechars!')).toBe(false)
    expect(isValidVideoId('abc DEF_123')).toBe(false)
  })
})

describe('extractVideoId', () => {
  it('parses canonical watch URLs', () => {
    expect(extractVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(extractVideoId(`https://youtube.com/watch?v=${ID}&t=42s`)).toBe(ID)
  })

  it('parses youtu.be share links', () => {
    expect(extractVideoId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(extractVideoId(`https://youtu.be/${ID}?si=tracking`)).toBe(ID)
  })

  it('parses shorts, embed, live, and /v/ paths', () => {
    expect(extractVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(extractVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(extractVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
    expect(extractVideoId(`https://www.youtube.com/v/${ID}`)).toBe(ID)
  })

  it('parses mobile and music subdomains', () => {
    expect(extractVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(extractVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('rejects non-YouTube hosts, invalid ids, and junk', () => {
    expect(extractVideoId(`https://vimeo.com/${ID}`)).toBe(null)
    expect(extractVideoId('https://www.youtube.com/watch?v=tooshort')).toBe(null)
    expect(extractVideoId('https://www.youtube.com/playlist?list=PL123')).toBe(null)
    expect(extractVideoId('not a url')).toBe(null)
    expect(extractVideoId('')).toBe(null)
    // Lookalike host must not match the .youtube.com suffix check
    expect(extractVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBe(null)
  })
})

describe('parseYouTubeInput', () => {
  it('accepts a bare video id', () => {
    expect(parseYouTubeInput(ID)).toBe(ID)
    expect(parseYouTubeInput(`  ${ID}  `)).toBe(ID)
  })

  it('accepts full URLs', () => {
    expect(parseYouTubeInput(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYouTubeInput(`https://youtu.be/${ID}`)).toBe(ID)
  })

  it('accepts protocol-less URLs', () => {
    expect(parseYouTubeInput(`youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYouTubeInput(`www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(parseYouTubeInput(`youtu.be/${ID}`)).toBe(ID)
    expect(parseYouTubeInput(`music.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('rejects junk', () => {
    expect(parseYouTubeInput('')).toBe(null)
    expect(parseYouTubeInput('   ')).toBe(null)
    expect(parseYouTubeInput('hello world')).toBe(null)
    expect(parseYouTubeInput('https://example.com/watch?v=' + ID)).toBe(null)
  })
})

describe('canonicalYouTubeUrl', () => {
  it('produces the canonical watch URL', () => {
    expect(canonicalYouTubeUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})
