import { describe, it, expect } from 'vitest'
import { isStaleBuildError } from '@/lib/staleBuild'

describe('isStaleBuildError', () => {
  it('recognises each browser’s failed lazy import', () => {
    expect(isStaleBuildError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/server-abc.js'))).toBe(true)
    expect(isStaleBuildError(new TypeError('error loading dynamically imported module: https://x/assets/server-abc.js'))).toBe(true)
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('leaves other errors alone', () => {
    expect(isStaleBuildError(new Error('range is empty'))).toBe(false)
    expect(isStaleBuildError('Failed to fetch')).toBe(false)
  })
})
