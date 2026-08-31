import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { loadCatalogue } from '../lib/catalogue'

const OUT = '.output/public'

describe('prerendered station pages', () => {
  it('emits exactly one page per station', () => {
    if (!existsSync(OUT)) return expect.fail('run `pnpm build` before this test')
    const all = loadCatalogue()
    const missing = all.filter(
      (s) => !existsSync(`${OUT}/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/index.html`),
    )
    expect(missing.slice(0, 5).map((s) => s.id)).toEqual([])
    expect(missing.length).toBe(0)
  })

  it('renders the station name and a real curve, not a placeholder', () => {
    // Brief's test named this slug `deception-pass`; the catalogue's actual
    // slug for `noaa/PUG1701` (the HERO_STATION) is `deception-pass-narrows` —
    // confirmed against loadCatalogue() output, not adjusted to dodge a failure.
    const html = readFileSync(`${OUT}/currents/deception-pass-narrows/index.html`, 'utf8')
    expect(html).toContain('Deception Pass (Narrows)')
    expect(html).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
    expect(html).toContain(
      '<link rel="canonical" href="https://slackwater.xyz/currents/deception-pass-narrows/"',
    )
  })

  it('claims nothing about now in HTML that was rendered days ago', () => {
    // A prerendered page is served for as long as the deploy lasts, so a
    // relative "in 30m" or a "next slack" in it is a live-sounding reading
    // computed against the build clock — wrong for every reader without JS,
    // which is the AI crawlers and unfurl scrapers this corpus exists for.
    const html = readFileSync(`${OUT}/currents/deception-pass-narrows/index.html`, 'utf8')
    expect(html).not.toMatch(/in \d+[hm]\b/)
    expect(html).not.toContain('Next slack')
    expect(html).not.toContain('this device')
  })

  it('dates the page, so a reader can tell which day it shows', () => {
    // The chart speaks in bare hh:mm. Without a date on the page a receiver
    // cannot tell whether they are looking at today's water or a link from
    // last winter.
    const html = readFileSync(`${OUT}/tides/seattle/index.html`, 'utf8')
    expect(html).toMatch(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}/)
  })

  it('shows a tide range that could only be feet', () => {
    // Seattle swings about 10 ft. The database ships metres; a page that
    // labels those metres "ft" reads 3.28x shallow and entirely plausible.
    const html = readFileSync(`${OUT}/tides/seattle/index.html`, 'utf8')
    const m = html.match(/High (-?[\d.]+) feet[\s\S]*?low (-?[\d.]+) feet/)
    expect(m, 'no high/low in the accessibility text').not.toBeNull()
    expect(Number(m![1]) - Number(m![2])).toBeGreaterThan(8)
  })

  it('does not announce the wrong station to screen readers', () => {
    // The accessibility text was hardcoded to one station; across 3,607 pages
    // that would misname every one of them.
    const html = readFileSync(`${OUT}/tides/seattle/index.html`, 'utf8')
    expect(html).not.toContain('Deception Pass')
  })
})
