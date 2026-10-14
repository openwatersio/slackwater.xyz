import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COMPARE_PATHS } from './compare'
import { ORGANIZATION } from './json-ld'
import { TCD } from './links'

it('publishes the support page and its Markdown source', () => {
  expect(existsSync('.output/public/support.md')).toBe(true)

  const page = readFileSync('.output/public/support/index.html', 'utf8')
  const markdown = readFileSync('.output/public/support.md', 'utf8')

  expect(page).toContain('href="/support.md"')
  expect(page).toContain('slackwater@openwaters.io')
  expect(markdown).toContain('# Support')
  expect(markdown).toContain('slackwater@openwaters.io')
})

it('publishes the accuracy receipt from its maintained Markdown source', () => {
  const page = readFileSync('.output/public/accuracy/index.html', 'utf8')
  const markdown = readFileSync('.output/public/accuracy.md', 'utf8')
  expect(page).toContain('href="/accuracy.md"')
  expect(markdown).toBe(readFileSync('src/content/accuracy.md', 'utf8'))
})

it('links the OpenCPN download to the database release the site is built against', async () => {
  const page = readFileSync('.output/public/opencpn/index.html', 'utf8')
  expect(page).toContain(`href="${TCD.url}"`)
})

it('counts the OpenCPN comparison from the database release the site is built against', async () => {
  // The station counts and quality figures in opencpn.md are written by hand
  // from one release. This can't check the figures themselves; it fails on a
  // database bump as a reminder to recount them and update the release refs.
  const { version } = await import('@slackwater/database/package.json')
  const markdown = readFileSync('src/content/opencpn.md', 'utf8')
  expect(markdown).toContain(TCD.date ? `slackwater-${TCD.date}.tcd` : `v${version}`)
  expect(markdown).toContain(`slackwater-database/blob/v${version}/quality.json`)
})

describe('structured data', () => {
  const blocks = (path: string) =>
    [...readFileSync(`.output/public${path}index.html`, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1]),
    )
  const sitemap = readFileSync('.output/public/sitemap-static.xml', 'utf8')
  const lastmod = (path: string) => sitemap.match(new RegExp(`<loc>https://slackwater.xyz${path}</loc><lastmod>([^<]+)`))?.[1]
  const shown = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  it('dates the pages that print no date by their sitemap lastmod', () => {
    for (const path of ['/learn/tides/', '/accuracy/']) {
      const [article] = blocks(path)
      expect(article['@type'], path).toBe('Article')
      expect(article.dateModified, path).toBe(lastmod(path))
      expect(article.publisher, path).toEqual(ORGANIZATION)
    }
  })

  it('dates every comparison by a date the page shows, and marks up no rating', () => {
    for (const path of COMPARE_PATHS) {
      const html = readFileSync(`.output/public${path}index.html`, 'utf8')
      const [article] = blocks(path)
      expect(article['@type'], path).toBe('Article')
      expect(html, path).toContain(shown(article.dateModified))
      expect(article.publisher, path).toEqual(ORGANIZATION)
      expect(JSON.stringify(blocks(path)), path).not.toMatch(/Rating|Review/)
    }
  })

  it('dates the OpenCPN dataset by the release the page says it was updated', () => {
    const [dataset] = blocks('/opencpn/')
    expect(dataset['@type']).toBe('Dataset')
    expect(dataset.distribution.contentUrl).toBe(TCD.url)
    // React separates adjacent text with `<!-- -->`.
    expect(readFileSync('.output/public/opencpn/index.html', 'utf8').replaceAll('<!-- -->', '')).toContain(`Updated ${shown(dataset.dateModified)}`)
  })

  it('lists the stations hub and leaves support and privacy unmarked', () => {
    expect(blocks('/stations/')[0]['@type']).toBe('CollectionPage')
    expect(blocks('/support/')).toEqual([])
    expect(blocks('/privacy/')).toEqual([])
  })
})
