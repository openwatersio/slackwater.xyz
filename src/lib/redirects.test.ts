import { describe, expect, it } from 'vitest'
import { buildRedirects } from './redirects'

describe('static page redirects', () => {
  it('redirects exact pages and station siblings permanently without a catch-all', () => {
    const rules = buildRedirects(['/tides/us/wa/seattle/', '/tides/us/wa/tacoma/'], ['/', '/support/', '/tides/us/wa/'])
    expect(rules).toContain('/support /support/ 308')
    expect(rules).toContain('/tides/us/wa /tides/us/wa/ 308')
    expect(rules).toContain('/tides/us/wa/:page /tides/us/wa/:page/ 308')
    expect(rules).not.toContain('/*')
    expect(rules).not.toContain('/ / 308')
  })

  it('uses exact rules for small groups to stay within Cloudflare limits', () => {
    const paths = Array.from({ length: 101 }, (_, i) => [`/tides/c${i}/a/`, `/tides/c${i}/b/`]).flat()
    const rules = buildRedirects(paths).trim().split('\n')
    expect(rules.filter((line) => line.includes(':page'))).toHaveLength(100)
    expect(rules.filter((line) => !line.includes(':page'))).toHaveLength(2)
    expect(() => buildRedirects([], Array.from({ length: 2001 }, (_, i) => `/p${i}/`))).toThrow('2,000')
  })
})
