import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { formerSlugs } from './routes'
import { buildRedirects, PUBLISHED, REDIRECT_LIMIT } from './redirects'
import { stationPath } from './station'

describe('buildRedirects', () => {
  const catalogue = loadCatalogue()
  const text = buildRedirects(catalogue)
  const lines = text.trim().split('\n').map((line) => line.split(' ') as [string, string, string])
  // One rule per spelling; the map below keys on the canonical, slashed one.
  const rules = new Map(lines.filter(([from]) => from.endsWith('/')).map(([from, to]) => [from, to]))
  const live = new Set(catalogue.map((s) => stationPath(s.kind, s.slug)))

  it('keeps every URL this site published reachable', () => {
    // The contract of the switch: nothing anyone linked to stops resolving.
    // Every address the site once minted is either still the station's or
    // redirects to it — the ones the database recorded, and the one it did not.
    const published = catalogue.flatMap((s) =>
      [PUBLISHED[s.kind][s.id], ...formerSlugs(s.kind, s.id)].filter(Boolean).map((slug) => stationPath(s.kind, slug!)),
    )
    expect(published.length).toBeGreaterThan(200)
    const lost = published.filter((path) => !live.has(path) && !rules.has(path))
    expect(lost).toEqual([])
  })

  it('sends every redirect to a live page, and none from one', () => {
    for (const [from, to] of rules) {
      expect(live.has(to), `${from} -> ${to}`).toBe(true)
      expect(live.has(from), `${from} is live and redirected`).toBe(false)
    }
  })

  it('stays under the ceiling Cloudflare reads', () => {
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.length).toBeLessThanOrEqual(REDIRECT_LIMIT)
  })

  it('redirects a link with no trailing slash, the shape the app shares', () => {
    for (const [from, to] of rules) expect(text).toContain(`${from.slice(0, -1)} ${to} 301\n`)
  })

  it('writes the one line shape Cloudflare parses', () => {
    // Sawyer Key inside and outside were one bare slug and a `-fl`; the
    // database now names the water. Ogdensburg is the other source: the
    // database\'s bare slug is the NOAA twin this site does not publish, so the
    // copy it does moves and only the site\'s own table knows the old address.
    expect(text).toContain('/tides/sawyer-key/ /tides/sawyer-key-inside-cudjoe-channel/ 301\n')
    expect(text).toContain('/tides/ogdensburg/ /tides/ogdensburg-ny/ 301\n')
    expect(text).toMatch(/^(\/(tides|currents)\/[a-z0-9-]+\/? \/(tides|currents)\/[a-z0-9-]+\/ 301\n)+$/)
  })
})
