import { describe, it, expect } from 'vitest'
import { fileHost, rawFileUrl, shareUrl, srcParam } from '@/lib/shareLink'

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

  it('read a Dropbox share link from its direct-download host', () => {
    expect(rawFileUrl('https://www.dropbox.com/scl/fi/abc/alive.strata?rlkey=k1&dl=0')).toBe(
      'https://dl.dropboxusercontent.com/scl/fi/abc/alive.strata?rlkey=k1',
    )
    expect(rawFileUrl('https://www.dropbox.com/s/xyz/alive.strata?dl=0')).toBe('https://dl.dropboxusercontent.com/s/xyz/alive.strata')
  })

  it('read a OneDrive share link through the sharing API', () => {
    const out = rawFileUrl('https://1drv.ms/u/s!AbCd?e=x')!
    expect(out.startsWith('https://api.onedrive.com/v1.0/shares/u!')).toBe(true)
    expect(out.endsWith('/root/content')).toBe(true)
    // base64url: no '+', '/' or '=' inside the encoded link
    const token = out.slice(out.indexOf('u!') + 2, out.indexOf('/root'))
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('recognise a Google Drive link and decline it', () => {
    const link = 'https://drive.google.com/file/d/1AbC-d_E/view?usp=sharing'
    expect(fileHost(link)).toBe('gdrive')
    expect(rawFileUrl(link)).toBeNull()
  })

})
