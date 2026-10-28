import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COMPARE_PATHS } from './compare'
import { ORGANIZATION } from './json-ld'
import { APP_STORE_REVIEW, TCD } from './links'
import counts from '../content/opencpn-counts.json' with { type: 'json' }
// @ts-expect-error a plain .mjs tool shared with tools/count-opencpn.mjs
import { qualityCounts } from '../../tools/quality.mjs'

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

it('lists the ways to help in order, with the review link links.ts names (#241)', () => {
  for (const name of ['pricing', 'support']) {
    const source = readFileSync(`src/content/${name}.md`, 'utf8')
    const help = source.slice(source.search(/^(## |<h2 id="help">)Help Slackwater/m))
    const order = ['a rating', 'write a review', 'with a friend', 'Buy Premium'].map((step) => help.indexOf(step))
    expect(order, name).not.toContain(-1)
    expect(order, name).toEqual([...order].sort((a, b) => a - b))
    expect(help, name).toContain(`(${APP_STORE_REVIEW})`)
    expect(help, name).toContain('(/pricing/#payment)')
  }
  expect(readFileSync('src/content/about.md', 'utf8')).toContain(`(${APP_STORE_REVIEW})`)
})

it('links the OpenCPN download to the database release the site is built against', async () => {
  const page = readFileSync('.output/public/opencpn/index.html', 'utf8')
  expect(page).toContain(`href="${TCD.url}"`)
})

describe('the OpenCPN comparison', () => {
  // `node tools/count-opencpn.mjs` recounts every figure below into
  // opencpn-counts.json. The TCD-derived counts need files this test does not
  // download, so they are checked against the recorded run; the quality
  // figures are recomputed here from the installed database.
  const markdown = readFileSync('src/content/opencpn.md', 'utf8')
  const n = (value: number) => value.toLocaleString('en-US')

  it('names the Japan Coast Guard reuse terms and requires credit for modified data', () => {
    expect(markdown).toContain('[Government Standard Terms of Use 2.0](https://www1.kaiho.mlit.go.jp/copyright.html)')
    expect(markdown).toContain('identify modifications')
    expect(markdown).toContain('government-produced')
  })

  it('was counted from the database release the site is built against', async () => {
    const { version } = await import('@slackwater/database/package.json')
    expect(counts.database, 'run `node tools/count-opencpn.mjs` after a database bump').toBe(version)
    expect(markdown).toContain(TCD.date ? `slackwater-${TCD.date}.tcd` : `v${version}`)
    expect(markdown).toContain(`slackwater-database/blob/v${version}/docs/quality-evaluation.md`)
    expect(markdown).toContain(`slackwater-database/tree/v${version}/stations`)
  })

  it('quotes the quality figures the database records', async () => {
    expect(await qualityCounts()).toEqual(counts.quality)
    const { evaluated, rejected, reasons } = counts.quality
    expect(markdown).toContain(`evaluated ${n(evaluated)} candidate tide stations and left out ${n(rejected)}.`)
    expect(markdown).toContain(`${n(reasons.duplicate)} duplicated a better station nearby`)
    expect(markdown).toContain(`${n(reasons.superseded)} relayed a gauge`)
    expect(markdown).toContain(`${n(reasons.datum)} had tidal levels in the wrong order`)
    expect(markdown).toContain(`${n(reasons.range)} had a tidal range under 2 cm`)
    expect(markdown).toContain(`${n(reasons.timing)} ran on a clock offset`)
    expect(markdown).toContain(`${n(reasons.constituents)} had constituents that aren't physically plausible`)
    expect(markdown).toContain(`${n(reasons.seasonal)} had a yearly term out of line`)
    // A reason the page does not name would leave the sentence short.
    expect(Object.keys(reasons).sort()).toEqual(['constituents', 'datum', 'duplicate', 'range', 'seasonal', 'superseded', 'timing'])
  })

  it('quotes the station counts in the table', () => {
    const row = (label: string) => markdown.match(new RegExp(`^\\| ${label}\\s*\\|([^\\n]+)$`, 'm'))?.[1].split('|').map((c) => c.trim()).slice(0, 3)
    expect(row('Tide stations')).toEqual([counts.slackwater.tide, counts.opencpn514.tide, counts.opencpn512.tide].map(n))
    expect(row('Current stations')).toEqual([counts.slackwater.current, counts.opencpn514.current, counts.opencpn512.current].map(n))
    expect(markdown).toContain(`It lists ${n(counts.ticonRepeatedNames)} station names more than once`)
    expect(markdown).toContain(`OpenCPN ${counts.opencpn.replace('Release_', '')}'s \`tcdata\` folder`)
  })

  it('quotes the stations NOAA no longer publishes, as of the day the lists were fetched', () => {
    const { asOf, tide, current } = counts.retired
    const day = new Date(`${asOf}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    expect(markdown).toContain(`As of ${day}, OpenCPN's 2021 file still lists ${n(tide.count)} tide stations and ${n(current.count)} current stations that NOAA no longer publishes predictions for.`)
    const states = current.states as Record<string, number>
    expect(markdown).toContain(`${n(tide.states.Alaska)} tide stations in Alaska and ${n(states['New Jersey'] + states.Delaware)} current stations in New Jersey and Delaware.`)
    // The sentence names the largest groups, so they must still be the largest.
    expect(Object.keys(tide.states)[0]).toBe('Alaska')
    expect(Object.keys(states).slice(0, 2).sort()).toEqual(['Delaware', 'New Jersey'])
  })

  it('quotes the world file stations Slackwater has nothing near, and the currents both carry', () => {
    const { total, worldFile, worldByCountry: c } = counts.extraTides as { total: number; worldFile: number; worldByCountry: Record<string, number> }
    expect(markdown).toContain(`OpenCPN 5.14 has ${n(total)} tide locations with no Slackwater tide station within 1 km, and ${n(worldFile)} of them come from its 1995 to 2003 world file: ${n(c.Can)} in Canada, ${n(c.Jpn)} in Japan and ${n(c.Aus + c.Tasm + c.PNGu)} around Australia and Papua New Guinea.`)
    const { stations, inSlackwater, missingRetired } = counts.usCurrents
    expect(markdown).toContain(`Slackwater carries ${n(inSlackwater)} of the ${n(stations)} NOAA current stations in OpenCPN's US file, and NOAA no longer publishes ${n(missingRetired)} of the other ${n(stations - inSlackwater)}.`)
  })

  it('counts the Canadian current points inside the boxes the script names', () => {
    const { britishColumbia, bayOfFundy } = counts.worldCurrents
    expect(markdown).toContain(`includes ${n(britishColumbia)} current points in British Columbia`)
    expect(markdown).toContain(`and ${n(bayOfFundy)} around the Bay of Fundy and its approaches.`)
  })
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
      expect(article.dateModified, path).toBe(`${lastmod(path)}T12:00:00Z`)
      expect(article.publisher, path).toEqual(ORGANIZATION)
    }
  })

  it('dates every comparison by a date the page shows, and marks up no rating', () => {
    for (const path of COMPARE_PATHS) {
      const html = readFileSync(`.output/public${path}index.html`, 'utf8')
      const [article] = blocks(path)
      expect(article['@type'], path).toBe('Article')
      expect(html, path).toContain(shown(article.dateModified.slice(0, 10)))
      expect(article.publisher, path).toEqual(ORGANIZATION)
      expect(JSON.stringify(blocks(path)), path).not.toMatch(/Rating|Review/)
    }
  })

  it('dates the OpenCPN dataset by the release the page says it was updated', () => {
    const [dataset] = blocks('/opencpn/')
    expect(dataset['@type']).toBe('Dataset')
    expect(dataset.distribution.contentUrl).toBe(TCD.url)
    // React separates adjacent text with `<!-- -->`.
    expect(readFileSync('.output/public/opencpn/index.html', 'utf8').replaceAll('<!-- -->', '')).toContain(`Updated ${shown(dataset.dateModified.slice(0, 10))}`)
  })

  it('lists the stations hub and leaves support and privacy unmarked', () => {
    expect(blocks('/stations/')[0]['@type']).toBe('CollectionPage')
    expect(blocks('/support/')).toEqual([])
    expect(blocks('/privacy/')).toEqual([])
  })
})


describe('agent discovery', () => {
  it('ships readable HTML, metadata and JSON-LD before JavaScript runs', () => {
    const html = readFileSync('.output/public/index.html', 'utf8')
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, '')
    expect(html).toMatch(/<h1[ >]/)
    expect(text.length).toBeGreaterThan(500)
    expect(html).toContain('<html lang="en"')
    expect(html).toContain('rel="canonical" href="https://slackwater.xyz/"')
    expect(html).toContain('property="og:image"')
    expect(html).toContain('property="og:type" content="website"')
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)!
    const nodes = JSON.parse(block[1])['@graph']
    expect(nodes.find((node: Record<string, unknown>) => node['@type'] === 'MobileApplication').name).toBe('Slackwater')
  })

  it.each(['about', 'contact', 'privacy', 'pricing'])('publishes substantive %s HTML and its maintained Markdown', (name) => {
    const html = readFileSync(`.output/public/${name}/index.html`, 'utf8')
    const source = readFileSync(`src/content/${name}.md`, 'utf8')
    expect(source.length).toBeGreaterThan(500)
    expect(html).toMatch(/<h1[ >]/)
    expect(html).toContain(`href="/${name}.md"`)
    expect(readFileSync(`.output/public/${name}.md`, 'utf8')).toBe(source)
    expect(readFileSync('.output/public/sitemap-static.xml', 'utf8')).toContain(`<loc>https://slackwater.xyz/${name}/</loc>`)
  })

  it('publishes the homepage Markdown alternate', () => {
    expect(readFileSync('.output/public/index.md', 'utf8')).toBe(readFileSync('src/content/home.md', 'utf8'))
  })

  it('keeps llms.txt in the published format, with file lists under every H2', () => {
    const llms = readFileSync('.output/public/llms.txt', 'utf8')
    expect(llms).toMatch(/^# Slackwater\n\n> /)
    expect(llms).toContain('## When to use Slackwater')
    for (const section of llms.split(/^## .+$/m).slice(1)) {
      for (const line of section.trim().split('\n').filter(Boolean)) {
        expect(line).toMatch(/^- \[.+\]\(https:\/\/.+\)(?:: .+)?$/)
      }
    }
    expect(llms).toContain('Accept: text/markdown')
    expect(llms).toContain('not for navigation')
  })

  it('routes negotiated documents through the Worker before static assets', () => {
    const config = JSON.parse(readFileSync('.output/server/wrangler.json', 'utf8'))
    for (const path of ['/', '/about/', '/contact/', '/pricing/', '/support/', '/privacy/', '/accuracy/']) {
      expect(config.assets.run_worker_first).toContain(path)
    }
  })
})
