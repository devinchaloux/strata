import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EXAMPLES, exampleFileUrl, exampleLink } from '@/lib/examples'
import { srcParam } from '@/lib/shareLink'
import { readDocument } from '@/lib/documentLoad'

const demoPath = (file: string) => resolve(__dirname, '../../public/demos', file)

describe('the example analyses', () => {
  it('each listed example is a file in public/demos that opens without notices', () => {
    for (const example of EXAMPLES) {
      expect(existsSync(demoPath(example.file))).toBe(true)
      const { notices } = readDocument(JSON.parse(readFileSync(demoPath(example.file), 'utf8')))
      expect(notices).toEqual([])
    }
  })

  it('links to the file on the app’s own address, as a shared link', () => {
    const alive = EXAMPLES[0]
    expect(exampleFileUrl(alive, 'https://strata.example.com')).toBe('https://strata.example.com/demos/alive.strata')
    const link = exampleLink(alive, 'https://strata.example.com/?src=old#x')
    expect(link).toBe('https://strata.example.com/?src=https%3A%2F%2Fstrata.example.com%2Fdemos%2Falive.strata')
    expect(srcParam(link)).toBe('https://strata.example.com/demos/alive.strata')
  })
})
