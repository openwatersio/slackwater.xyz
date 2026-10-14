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
    expect(rules.filter((line) => !line.includes(':page') && line.endsWith(' 308'))).toHaveLength(2)
    expect(() => buildRedirects([], Array.from({ length: 2001 }, (_, i) => `/p${i}/`))).toThrow('2,000')
  })

  describe('former /stations/ browse pages', () => {
    const pages = ['/stations/', '/tides/', '/currents/', '/tides/ca/', '/tides/ca/bc/', '/tides/us/']
    const rules = buildRedirects([], pages).trim().split('\n')
    const moved = (from: string) => rules.filter((line) => line.startsWith(`${from} `))

    it.each([
      ['/stations/currents/', '/currents/'],
      ['/stations/tides/', '/tides/'],
      ['/stations/tides/canada/', '/tides/ca/'],
      ['/stations/tides/canada/bc/', '/tides/ca/bc/'],
    ])('sends %s to %s permanently, in both spellings', (from, to) => {
      expect(moved(from)).toEqual([`${from} ${to} 301`])
      expect(moved(from.slice(0, -1))).toEqual([`${from.slice(0, -1)} ${to} 301`])
    })

    it('leaves a former page whose replacement is gone to 404', () => {
      expect(moved('/stations/tides/united-states/wa/')).toEqual([])
      expect(moved('/stations/tides/united-states/wa')).toEqual([])
    })

    it('keeps /stations/ itself', () => {
      expect(rules.filter((line) => line.includes(' /stations/ ') || line.startsWith('/stations/ '))).toEqual(['/stations /stations/ 308'])
    })
  })
})
