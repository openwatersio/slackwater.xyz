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

  it('does not announce the wrong station to screen readers', () => {
    // The accessibility text was hardcoded to one station; across 3,607 pages
    // that would misname every one of them.
    const html = readFileSync(`${OUT}/tides/seattle/index.html`, 'utf8')
    expect(html).not.toContain('Deception Pass')
  })
})
