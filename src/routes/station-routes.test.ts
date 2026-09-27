import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { loadCatalogue } from '../lib/catalogue'
import { kindRoot, placeTree } from '../lib/places'
import type { Kind } from '../lib/station'

const OUT = '.output/public'

/** A station's built page, found by slug so a test names the water rather than its address. */
const page = (kind: Kind, slug: string) => {
  const s = loadCatalogue().find((s) => s.kind === kind && s.slug === slug)
  if (!s) throw new Error(`no ${kind} station ${slug}`)
  return `${OUT}${s.path}index.html`
}

describe('prerendered station pages', () => {
  it('emits one non-empty page per station', () => {
    if (!existsSync(OUT)) return expect.fail('run `pnpm build` before this test')
    // A truncated prerender write leaves a file that exists and holds nothing,
    // which existsSync alone called present. It happened once (issue #48) and
    // was caught only because it landed on `seattle`, one of the two slugs any
    // other assertion here reads; on any of the other 3,628 it would have gone
    // green and deployed a station page serving an empty document. The floor is
    // far below the smallest real page (6,232 bytes, currents/masset-sound) and
    // far above an empty one, so it fails on truncation without tracking size.
    const FLOOR = 2048
    const all = loadCatalogue()
    const bad = all.filter((s) => {
      const file = `${OUT}${s.path}index.html`
      return !existsSync(file) || statSync(file).size < FLOOR
    })
    expect(bad.slice(0, 5).map((s) => s.id)).toEqual([])
    expect(bad.length).toBe(0)
  })

  it('renders the station name and a real curve, not a placeholder', () => {
    // Brief's test named this slug `deception-pass`; the catalogue's actual
    // slug for `noaa/PUG1701` (the HERO_STATION) is `deception-pass-narrows` —
    // confirmed against loadCatalogue() output, not adjusted to dodge a failure.
    const html = readFileSync(page('current', 'deception-pass-narrows'), 'utf8')
    expect(html).toContain('Deception Pass (Narrows)')
    expect(html).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
    expect(html).toContain(
      '<link rel="canonical" href="https://slackwater.xyz/currents/us/wa/deception-pass-narrows/"',
    )
  })

  it('quotes station counts that match the catalogue', () => {
    // The homepage and /stations/ both state the corpus size in prose. Nothing
    // derives those numbers - they are written into the copy - so adding
    // stations silently makes the site claim a figure that is no longer true.
    // A count a reader could check is exactly the kind of number this codebase
    // has shipped wrong before.
    const all = loadCatalogue()
    const counts = {
      tide: all.filter((s) => s.kind === 'tide').length.toLocaleString('en-US'),
      current: all.filter((s) => s.kind === 'current').length.toLocaleString('en-US'),
    }
    for (const page of ['index.html', 'stations/index.html']) {
      const html = readFileSync(`${OUT}/${page}`, 'utf8')
      expect(html, `${page} misstates the tide count`).toContain(counts.tide)
      expect(html, `${page} misstates the current count`).toContain(counts.current)
    }
  })

  it('offers the app and links home on both page kinds', () => {
    // The whole point of the corpus: a shared link lands on someone WITHOUT the
    // app. A station page that renders the water and never offers the app is a
    // dead end, and one with no link home leaves 3,607 orphans with no internal
    // route back into the site. Both shipped missing once; this is the guard.
    //
    // `currents/dodd-narrows` is here too: the CHS branch replaces the whole
    // page body and the CTA for 23 gates, and before this was only covered by
    // "the file exists" - not by "it still has a CTA and a way home".
    const paths = [
      page('current', 'deception-pass-narrows'),
      page('tide', 'boston'),
      page('current', 'dodd-narrows'),
    ]
    for (const path of paths) {
      const html = readFileSync(path, 'utf8')
      expect(html, `${path} has no TestFlight CTA`).toContain(
        'https://testflight.apple.com/join/',
      )
      expect(html, `${path} has no link home`).toMatch(/<a[^>]+href="\/"/)
    }
  })

  it('keeps every browse page small enough to be worth loading', () => {
    // #33: the flat tide index shipped 4,792 links and 322 KB of loader data
    // nothing read back — 922 KB, 150 KB gzipped, on a site whose pitch is that
    // it loads instantly. The split answers that, and this is what keeps it
    // answered: the budget binds every page the tree mints, so a country or
    // subdivision quietly growing past it fails here rather than on the wire.
    const BUDGET = 250_000
    const pages = (['tide', 'current'] as Kind[]).flatMap((kind) => [
      kindRoot(kind),
      ...placeTree(loadCatalogue().filter((s) => s.kind === kind)).keys(),
    ])
    const over = pages
      .map((p) => [p, statSync(`${OUT}${p}index.html`).size] as const)
      .filter(([, size]) => size > BUDGET)
    expect(over).toEqual([])
  })

  it('reaches every station from the browse index without the sitemap', () => {
    // The corpus was orphaned from the homepage once already (#27). Splitting
    // the index puts two hops between the top of it and a station, so the
    // chain is walked rather than assumed: every page links every page below it,
    // and every station is linked from the page its path sits under.
    for (const kind of ['tide', 'current'] as Kind[]) {
      const stations = loadCatalogue().filter((s) => s.kind === kind)
      const html = new Map<string, string>()
      const read = (dir: string) => html.get(dir) ?? html.set(dir, readFileSync(`${OUT}${dir}index.html`, 'utf8')).get(dir)!
      const links = (from: string, to: string) => read(from).includes(`href="${to}"`)
      const unlinked = [
        ...[...placeTree(stations).values()].filter((p) => !links(p.up, p.path)).map((p) => p.path),
        ...stations.filter((s) => !links(s.path.replace(/[^/]+\/$/, ''), s.path)).map((s) => s.path),
      ]
      expect(unlinked.slice(0, 5)).toEqual([])
    }
  })

  it('files a station under its country and subdivision, and every crumb is a page', () => {
    const html = readFileSync(page('tide', 'bridesburg'), 'utf8')
    expect(page('tide', 'bridesburg')).toBe(`${OUT}/tides/us/pa/bridesburg/index.html`)
    for (const crumb of ['/tides/', '/tides/us/', '/tides/us/pa/']) {
      expect(html, crumb).toContain(`href="${crumb}"`)
      expect(existsSync(`${OUT}${crumb}index.html`), crumb).toBe(true)
    }
  })

  it('links home and offers the app from every station directory', () => {
    for (const path of ['stations', 'tides', 'currents']) {
      const html = readFileSync(`${OUT}/${path}/index.html`, 'utf8')
      expect(html, `${path} has no link home`).toMatch(/<a[^>]+href="\/"/)
      expect(html, `${path} has no TestFlight CTA`).toContain(
        'https://testflight.apple.com/join/',
      )
    }
  })

  it('claims nothing about now in HTML that was rendered days ago', () => {
    // A prerendered page is served for as long as the deploy lasts, so a
    // relative "in 30m" or a "next slack" in it is a live-sounding reading
    // computed against the build clock — wrong for every reader without JS,
    // which is the AI crawlers and unfurl scrapers this corpus exists for.
    const html = readFileSync(page('current', 'deception-pass-narrows'), 'utf8')
    expect(html).not.toMatch(/in \d+[hm]\b/)
    expect(html).not.toContain('Next slack')
    expect(html).not.toContain('this device')
  })

  it('dates the page, so a reader can tell which day it shows', () => {
    // The chart speaks in bare hh:mm. Without a date on the page a receiver
    // cannot tell whether they are looking at today's water or a link from
    // last winter.
    const html = readFileSync(page('tide', 'seattle'), 'utf8')
    expect(html).toMatch(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}/)
  })

  it('shows a tide range that could only be feet', () => {
    // Seattle swings about 10 ft. The database ships metres; a page that
    // labels those metres "ft" reads 3.28x shallow and entirely plausible.
    const html = readFileSync(page('tide', 'seattle'), 'utf8')
    const m = html.match(/High (-?[\d.]+) feet[\s\S]*?low (-?[\d.]+) feet/)
    expect(m, 'no high/low in the accessibility text').not.toBeNull()
    expect(Number(m![1]) - Number(m![2])).toBeGreaterThan(8)
  })

  it('does not announce the wrong station to screen readers', () => {
    // The accessibility text was hardcoded to one station; across 3,607 pages
    // that would misname every one of them.
    const html = readFileSync(page('tide', 'seattle'), 'utf8')
    expect(html).not.toContain('Deception Pass')
  })
})
