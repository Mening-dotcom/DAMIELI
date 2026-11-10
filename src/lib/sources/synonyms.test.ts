import { describe, it, expect } from 'vitest'
import { expandRoleTerms } from './synonyms'

describe('expandRoleTerms', () => {
  it('expands one seed into its whole family, English and Spanish', () => {
    const out = expandRoleTerms(['help desk'])
    expect(out).toContain('help desk')
    expect(out).toContain('service desk')
    expect(out).toContain('it support')
    expect(out).toContain('soporte técnico')
    expect(out).toContain('mesa de ayuda')
  })

  it('keeps unknown terms as-is instead of dropping them', () => {
    expect(expandRoleTerms(['underwater basket weaver'])).toContain('underwater basket weaver')
  })

  it('dedupes across overlapping seeds and respects the cap', () => {
    const out = expandRoleTerms(['help desk', 'it support', 'service desk'])
    expect(new Set(out).size).toBe(out.length)
    expect(expandRoleTerms(['help desk', 'customer support', 'interpreter', 'developer'], 10)).toHaveLength(10)
  })

  it('searches the user’s own words first', () => {
    expect(expandRoleTerms(['qa tester'])[0]).toBe('qa tester')
  })
})
