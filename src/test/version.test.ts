import { describe, it, expect } from 'vitest'
import { version } from '../../package.json'
import { versionLabel } from '@/lib/version'
import { reportIssueUrl } from '@/lib/issues'

describe('versionLabel', () => {
  it('is the package version and the short commit', () => {
    expect(versionLabel()).toMatch(/^\d+\.\d+\.\d+ \(([0-9a-f]{7}|dev)\)$/)
    expect(versionLabel().startsWith(`${version} (`)).toBe(true)
  })

  it('fills in the report form’s Strata version', () => {
    expect(new URL(reportIssueUrl()).searchParams.get('version')).toBe(versionLabel())
  })
})
