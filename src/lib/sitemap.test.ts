import { describe, expect, it } from 'vitest'
import { buildSitemaps } from './sitemap'
import { loadCatalogue } from './catalogue'

describe('buildSitemaps', () => {
  const maps = buildSitemaps(loadCatalogue(), [], (path) => (path === '/support/' ? '2026-09-01' : '2026-10-14'))

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
    expect(maps['sitemap-static.xml']).toContain('<loc>https://slackwater.xyz/learn/slack-water/</loc>')
  })

  it('lists every station exactly once, at its canonical URL', () => {
    const tides = maps['sitemap-tides.xml']
    expect((tides.match(/<loc>/g) ?? []).length).toBe(5893)
    expect(tides).toContain('<loc>https://slackwater.xyz/tides/us/wa/seattle/</loc>')
  })

  it('lists no instant URLs — they canonicalise to the station', () => {
    for (const xml of Object.values(maps)) expect(xml).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('dates every URL with the lastmod it is given', () => {
    for (const xml of Object.values(maps)) {
      expect((xml.match(/<lastmod>/g) ?? []).length).toBe((xml.match(/<loc>/g) ?? []).length)
    }
    expect(maps['sitemap-static.xml']).toContain(
      '<url><loc>https://slackwater.xyz/support/</loc><lastmod>2026-09-01</lastmod></url>',
    )
    expect(maps['sitemap-tides.xml']).toContain(
      '<url><loc>https://slackwater.xyz/tides/us/wa/seattle/</loc><lastmod>2026-10-14</lastmod></url>',
    )
  })

  it('dates each child sitemap in the index by its newest URL', () => {
    expect(maps['sitemap.xml']).toContain(
      '<sitemap><loc>https://slackwater.xyz/sitemap-static.xml</loc><lastmod>2026-10-14</lastmod></sitemap>',
    )
  })
})
