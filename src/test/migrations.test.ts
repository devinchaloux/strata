import { describe, it, expect } from 'vitest'
import { migrate, FILE_FORMAT_VERSION, MIGRATIONS } from '@/lib/migrations'

describe('migrate', () => {
  it('leaves a current document unchanged', () => {
    const doc = { fileFormatVersion: FILE_FORMAT_VERSION, title: 'x' }
    expect(migrate(doc)).toBe(doc)
  })

  it('never downgrades a document from a newer format', () => {
    const doc = { fileFormatVersion: FILE_FORMAT_VERSION + 1, title: 'x' }
    expect(migrate(doc)).toBe(doc)
  })

  it('has a step for every version below the current one', () => {
    for (let v = 1; v < FILE_FORMAT_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function')
  })
})
