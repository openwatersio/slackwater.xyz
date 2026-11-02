import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { addUrlset, changedUrls, type Entries, INDEXNOW_KEY, payloads, sitemapIndex } from './indexnow'
import { buildSitemaps } from './sitemap'
import { loadCatalogue } from './catalogue'

const O = 'https://slackwater.xyz'
const urlset = (rows: [string, string][]) =>
  `<urlset>\n${rows.map(([p, d]) => `  <url><loc>${O}${p}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>`
const site = (statics: [string, string][], tides: [string, string][]): Entries =>
  addUrlset(addUrlset(new Map(), 'sitemap-static.xml', urlset(statics)), 'sitemap-tides.xml', urlset(tides))

describe('changedUrls', () => {
  const live = site([['/', '2026-10-01'], ['/support/', '2026-10-01']], [['/tides/a/', '2026-10-18'], ['/tides/b/', '2026-10-18']])

  it('submits nothing for a nightly rebuild that only redates the stations', () => {
    const built = site([['/', '2026-10-01'], ['/support/', '2026-10-01']], [['/tides/a/', '2026-10-19'], ['/tides/b/', '2026-10-19']])
    expect(changedUrls(live, built)).toEqual([])
  })

  it('submits a page whose source changed', () => {
    const built = site([['/', '2026-10-01'], ['/support/', '2026-10-19']], [['/tides/a/', '2026-10-19'], ['/tides/b/', '2026-10-19']])
    expect(changedUrls(live, built)).toEqual([`${O}/support/`])
  })

  it('submits stations and pages that arrive or leave', () => {
    const built = site([['/', '2026-10-01'], ['/support/', '2026-10-01'], ['/learn/new/', '2026-10-19']], [['/tides/a/', '2026-10-19'], ['/tides/c/', '2026-10-19']])
    expect(changedUrls(live, built)).toEqual([`${O}/learn/new/`, `${O}/tides/b/`, `${O}/tides/c/`])
  })

  it('refuses to diff against live sitemaps that yielded nothing', () => {
    expect(() => changedUrls(new Map(), live)).toThrow(/no URLs/)
  })
})

describe('the sitemaps the build writes', () => {
  it('parse back into every URL, with stations marked daily', () => {
    const catalogue = loadCatalogue()
    const maps = buildSitemaps(catalogue, [], () => '2026-10-19')
    const files = sitemapIndex(maps['sitemap.xml']).map((u) => new URL(u).pathname.slice(1))
    expect(files.sort()).toEqual(['sitemap-currents.xml', 'sitemap-static.xml', 'sitemap-tides.xml'])
    const entries: Entries = new Map()
    for (const f of files) addUrlset(entries, f, maps[f])
    const station = catalogue[0]
    expect(entries.get(`${O}${station.path}`)).toEqual({ lastmod: '2026-10-19', daily: true })
    expect(entries.get(`${O}/support/`)).toEqual({ lastmod: '2026-10-19', daily: false })
    expect(entries.size).toBe(catalogue.length + [...maps['sitemap-static.xml'].matchAll(/<url>/g)].length)
  })
})

describe('payloads', () => {
  it('splits at the protocol limit of 10,000 URLs per request', () => {
    const urls = Array.from({ length: 10_001 }, (_, i) => `${O}/tides/${i}/`)
    expect(payloads(urls).map((p) => p.urlList.length)).toEqual([10_000, 1])
    expect(payloads([])).toEqual([])
  })
})

it('publishes the key file engines verify against', () => {
  expect(readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8').trim()).toBe(INDEXNOW_KEY)
})
