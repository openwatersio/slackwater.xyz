import { describe, expect, it } from 'vitest'
import { buildSitemaps } from './sitemap'
import { loadCatalogue } from './catalogue'

describe('buildSitemaps', () => {
  const maps = buildSitemaps(loadCatalogue())

  it('splits by kind, keeps the static pages separate, and indexes all three', () => {
    expect(Object.keys(maps).sort()).toEqual([
      'sitemap-currents.xml', 'sitemap-static.xml', 'sitemap-tides.xml', 'sitemap.xml',
    ])
  })

  it('makes the root an index, not a urlset', () => {
    // A sitemapindex may only reference other sitemaps. Page URLs in it are
    // invalid and Search Console rejects the file outright.
    expect(maps['sitemap.xml']).toContain('<sitemapindex')
    expect(maps['sitemap.xml']).not.toContain('<urlset')
    expect(maps['sitemap.xml']).toContain('<loc>https://slackwater.xyz/sitemap-tides.xml</loc>')
    expect(maps['sitemap-static.xml']).toContain('<loc>https://slackwater.xyz/support/</loc>')
  })

  it('lists every station exactly once, at its canonical URL', () => {
    const tides = maps['sitemap-tides.xml']
    expect((tides.match(/<loc>/g) ?? []).length).toBe(2775)
    expect(tides).toContain('<loc>https://slackwater.xyz/tides/seattle/</loc>')
  })

  it('lists no instant URLs — they canonicalise to the station', () => {
    for (const xml of Object.values(maps)) expect(xml).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})
