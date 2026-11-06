import { describe, expect, it } from 'vitest'
import { loadCatalogue, stationAttribution } from './catalogue'
import { buildSitemaps } from './sitemap'
import { buildStationIndex, type StationIndex } from './station-index'

describe('buildStationIndex', () => {
  const catalogue = loadCatalogue()
  const index: StationIndex = JSON.parse(buildStationIndex(catalogue, stationAttribution))

  it('lists exactly the stations the sitemaps list', () => {
    const maps = buildSitemaps(catalogue, [], () => '2026-11-06')
    const sitemapPaths = [maps['sitemap-tides.xml'], maps['sitemap-currents.xml']]
      .flatMap((xml) => [...xml.matchAll(/<loc>https:\/\/slackwater\.xyz([^<]+)<\/loc>/g)].map((m) => m[1]))
    expect(index.stations.map((s) => s.path).sort()).toEqual(sitemapPaths.sort())
  })

  it('gives each station its kind, name and position, rounded to about 10 m', () => {
    const seattle = index.stations.find((s) => s.path === '/tides/us/wa/seattle/')
    expect(seattle).toMatchObject({ kind: 'tide', name: expect.stringMatching(/Seattle/) })
    for (const s of index.stations) {
      expect(['tide', 'current']).toContain(s.kind)
      // JSON writes NaN as null, which the range checks below would pass.
      expect(Number.isFinite(s.latitude), s.path).toBe(true)
      expect(Number.isFinite(s.longitude), s.path).toBe(true)
      expect(Math.abs(s.latitude)).toBeLessThanOrEqual(90)
      expect(Math.abs(s.longitude)).toBeLessThanOrEqual(180)
      expect(String(s.latitude).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4)
      expect(String(s.longitude).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4)
    }
  })

  it('names its origin, so a consumer can build absolute links', () => {
    expect(index.origin).toBe('https://slackwater.xyz')
  })

  it('points at the licence the station data carries, as the OpenCPN dataset does', () => {
    expect(index.license).toBe('https://github.com/openwatersio/slackwater-database#license')
  })

  // The database's rule for redistributing a station: display its attribution.
  it("carries every station's attribution, each notice listed once", () => {
    expect(new Set(index.attributions).size).toBe(index.attributions.length)
    for (const s of index.stations) expect(index.attributions[s.attribution], s.path).toMatch(/\S/)
    const andenes = index.stations.find((s) => s.path === '/tides/no/andenes/')!
    expect(index.attributions[andenes.attribution]).toMatch(/Kartverket/)
  })

  it('fails the build rather than publish a station without its notice', () => {
    expect(() => buildStationIndex(catalogue.slice(0, 1), () => '')).toThrow(/attribution/)
  })
})
