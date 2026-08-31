import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { dayLabel, hhmm } from '#/lib/format'
import { findEvents } from '#/lib/predict'
import type { Station } from '#/lib/station'

/**
 * The instant URL must render ITS OWN moment.
 *
 * `instant.test.ts` next door tests `parseInstant` alone, and passed through
 * nine reviews while every instant URL rendered the canonical page frozen at
 * a build-time constant: flat routing had made the instant route a child of
 * `<kind>.$slug.tsx`, whose component renders no <Outlet/>, so the loader ran
 * (correct 404s, canonical and og:image) but the component never mounted.
 * Two different instants rendered byte-identical pages while the OG card was
 * right — a shared link unfurled the right hour and landed on another.
 *
 * So: render two different instants and require the bodies to differ, and to
 * carry times computed from their own instant. Nothing short of rendering the
 * route through the real route tree catches a nesting bug.
 */

const DECEPTION: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
}
const SEATTLE: Station = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}

// The loader reaches the catalogue through a server function, which needs a
// Start server context this test has no business standing up. The subject here
// is routing and rendering, not the lookup.
vi.mock('#/lib/catalogue-server', () => ({
  stationBySlug: async ({ data }: { data: { kind: string; slug: string } }) =>
    [DECEPTION, SEATTLE].find((s) => s.kind === data.kind && s.slug === data.slug),
}))

const { routeTree } = await import('#/routeTree.gen')

async function body(url: string) {
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [url] }) })
  await router.load()
  const html = renderToString(<RouterProvider router={router} />)
  return html.slice(html.indexOf('<body'))
}

/**
 * A slack the chart actually labels, as it labels it.
 *
 * The chart drops labels in the outer 7% of the window, where the fill has
 * faded out — so "the first slack" is not necessarily one that appears.
 */
function labelledSlack(station: Station, instant: Date) {
  const start = new Date(instant.getTime() - 6 * 3600_000)
  const span = 24 * 3600_000
  const slack = findEvents(station, start, 24).find((e) => {
    const at = (e.time.getTime() - start.getTime()) / span
    return e.kind === 'slack' && at > 0.08 && at < 0.92
  })
  if (!slack) throw new Error('fixture has no labelled slack in frame')
  return hhmm(slack.time, station.timezone)
}

describe('the instant URL renders its own moment', () => {
  const CHRISTMAS = '2026-12-25T03:15-08:00'
  const MAYDAY = '2027-05-01T09:00Z'

  it('renders two different current instants as two different pages', async () => {
    const a = await body(`/currents/deception-pass-narrows/${CHRISTMAS}`)
    const b = await body(`/currents/deception-pass-narrows/${MAYDAY}`)
    expect(a).not.toBe(b)
    expect(a).toContain(dayLabel(new Date(CHRISTMAS), DECEPTION.timezone))
    expect(b).toContain(dayLabel(new Date(MAYDAY), DECEPTION.timezone))
    // Not merely different: each page's chart is computed from its own instant.
    expect(a).toContain(labelledSlack(DECEPTION, new Date(CHRISTMAS)))
    expect(b).toContain(labelledSlack(DECEPTION, new Date(MAYDAY)))
  })

  it('renders two different tide instants as two different pages', async () => {
    const a = await body(`/tides/seattle/${CHRISTMAS}`)
    const b = await body(`/tides/seattle/${MAYDAY}`)
    expect(a).not.toBe(b)
    expect(a).toContain(dayLabel(new Date(CHRISTMAS), SEATTLE.timezone))
    expect(b).toContain(dayLabel(new Date(MAYDAY), SEATTLE.timezone))
  })

  it('does not render the canonical page instead', async () => {
    // The canonical page freezes at 2026-08-21 for the server render. If the
    // instant route stops mounting again, that date is what comes back.
    const a = await body(`/currents/deception-pass-narrows/${CHRISTMAS}`)
    const canonical = await body('/currents/deception-pass-narrows')
    expect(a).not.toBe(canonical)
    expect(a).not.toContain('Aug 2026')
  })

  it('404s a malformed instant rather than rendering some other moment', async () => {
    const html = await body('/currents/deception-pass-narrows/not-a-time')
    expect(html).toContain('Not published')
  })
})

describe('the server render claims nothing about now', () => {
  it('leaves the relative "in Xm" countdown to the hydrated client', async () => {
    for (const url of ['/currents/deception-pass-narrows', '/currents/deception-pass-narrows/2026-12-25T03:15-08:00']) {
      expect(await body(url), url).not.toMatch(/in \d+[hm]/)
    }
  })

  it('says nothing about the device that computed it', async () => {
    // "computed on this device" is false in prerendered HTML.
    expect(await body('/currents/deception-pass-narrows')).not.toContain('this device')
  })
})
