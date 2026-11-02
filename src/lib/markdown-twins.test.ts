import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { earthMoonMeasurements } from '#/components/TideOrbit'
import { COMPARE_PAGES } from './compare'
import { compareMarkdown, opencpnMarkdown, stationsMarkdown } from './markdown-twins'
import { TCD } from './links'

const headings = (markdown: string) => [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1])

describe('markdown twins', () => {
  it('starts every comparison twin at its top-level heading', () => {
    for (const page of Object.values(COMPARE_PAGES)) {
      const markdown = compareMarkdown(page)
      expect(markdown, page.path).toMatch(/^# /)
      expect(markdown, page.path).not.toContain('\nurl: ')
    }
  })

  it('carries the OpenCPN download and every section of its page', () => {
    const markdown = opencpnMarkdown()
    expect(markdown).toMatch(/^# Slackwater for OpenCPN\n/)
    expect(markdown).toContain(`](${TCD.url})`)
    expect(markdown).toContain(readFileSync('src/content/opencpn.md', 'utf8').trim())
    expect(readFileSync('src/routes/opencpn.tsx', 'utf8')).toContain('Install it in OpenCPN')
  })

  // The learn pages are JSX with their prose inline, so their twins repeat it.
  // A section added to or renamed in the page fails here until the twin follows.
  const prose = (text: string) => text.replace(/&rsquo;|’/g, "'").replace(/\s+/g, ' ')
  const slackTwin = readFileSync('src/lib/markdown-twins.ts', 'utf8').split('export function slackWaterMarkdown')[1]
  it.each([
    ['learn-tides.md', readFileSync('src/content/learn-tides.md', 'utf8'), 'src/routes/learn.tides.tsx'],
    ['slackWaterMarkdown', slackTwin, 'src/components/SlackWaterGuide.tsx'],
  ])('keeps the sections of %s in step with %s', (_, twin, page) => {
    const source = prose(readFileSync(page, 'utf8'))
    const sections = headings(twin)
    expect(sections.length).toBeGreaterThan(3)
    for (const heading of sections) expect(source, heading).toContain(prose(heading))
  })

  it('states the same Earth–Moon figures as the tides page computes', () => {
    const markdown = readFileSync('src/content/learn-tides.md', 'utf8')
    const m = earthMoonMeasurements()
    expect(markdown).toContain(`${Math.round(m.earthToBarycenterKm).toLocaleString('en-US')} km`)
    expect(markdown).toContain(`${Math.round(m.barycenterToMoonKm).toLocaleString('en-US')} km`)
    expect(markdown).toContain(`${m.earthSpeedMps.toFixed(1)} m/s`)
  })

  it('lists each kind of station with its countries', () => {
    const markdown = stationsMarkdown({
      tide: { href: '/tides/', count: 5893, top: [{ href: '/tides/us/', name: 'United States', count: 3001 }] },
      current: { href: '/currents/', count: 2557, top: [{ href: '/currents/ca/', name: 'Canada', count: 200 }] },
    })
    expect(markdown).toMatch(/^# Stations\n/)
    expect(markdown).toContain('## [Tide stations](/tides/)')
    expect(markdown).toContain('- [United States](/tides/us/): 3,001 stations')
    expect(markdown).toContain('2,557 across the US and Canada.')
  })
})
