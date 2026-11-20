import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { dayLabel, dayStart, hhmm } from '#/lib/format'
import { findEvents } from '#/lib/predict'
import { SERVER_NOW } from '#/lib/use-live-now'
import type { BundledStation, ChsStation } from '#/lib/station'

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

const DECEPTION: BundledStation = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', path: '/currents/us/wa/deception-pass-narrows/',
  name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  source: 'bundled',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
}
const SEATTLE: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', path: '/tides/us/wa/seattle/', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}
const ARRAN: ChsStation = {
  id: 'chs-arran-rapids', kind: 'current', slug: 'arran-rapids', path: '/currents/ca/bc/arran-rapids/',
  name: 'Arran Rapids', source: 'chs', region: 'Stuart Island',
  latitude: 50.42, longitude: -125.14, timezone: 'America/Vancouver',
}

// The loader reaches the catalogue through a server function, which needs a
// Start server context this test has no business standing up. The subject here
// is routing and rendering, not the lookup.
//
// Every server function a route imports must be mocked here. A missing one
// throws inside the loader, and the router then renders the SAME error page for
// both instants - which looks exactly like the nesting bug this file exists to
// catch, and sends you hunting in the wrong place.
vi.mock('#/lib/catalogue-server', () => ({
  resolvePath: async ({ data }: { data: { kind: string; path: string } }) => {
    const mine = [DECEPTION, SEATTLE, ARRAN].filter((s) => s.kind === data.kind)
    const station = mine.find((s) => s.path === data.path)
    if (station) return { page: 'station', station, nearby: [], crumbs: [] }
    const flat = mine.find((s) => data.path.endsWith(`s/${s.slug}/`))
    return flat ? { page: 'redirect', path: flat.path } : undefined
  },
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
 * A slack on the shared moment's own day, as the 7-day table times it. The
 * table starts on that day, so a page computed from any other moment has a
 * different first day and, almost always, different slack times.
 */
function tabledSlack(station: BundledStation, instant: Date) {
  const slack = findEvents(station, dayStart(instant, station.timezone), 24).find((e) => e.kind === 'slack')
  if (!slack) throw new Error('fixture has no slack on the shared day')
  return `>${hhmm(slack.time, station.timezone)}</time>`
}

/** The moment the strip opens on, in ms. */
const stripMoment = (html: string) => Number(html.match(/<div role="slider"[^>]*aria-valuenow="(\d+)"/)?.[1])

describe('the instant URL renders its own moment', () => {
  const CHRISTMAS = '2026-12-25T03:15-08:00'
  const MAYDAY = '2027-05-01T09:00Z'

  it('renders two different current instants as two different pages', async () => {
    const a = await body(`/currents/us/wa/deception-pass-narrows/${CHRISTMAS}`)
    const b = await body(`/currents/us/wa/deception-pass-narrows/${MAYDAY}`)
    expect(a).not.toBe(b)
    expect(a).toContain(dayLabel(new Date(CHRISTMAS), DECEPTION.timezone))
    expect(b).toContain(dayLabel(new Date(MAYDAY), DECEPTION.timezone))
    // Not merely different: each page's table is computed from its own
    // instant, and its strip opens on it.
    expect(a).toContain(tabledSlack(DECEPTION, new Date(CHRISTMAS)))
    expect(b).toContain(tabledSlack(DECEPTION, new Date(MAYDAY)))
    expect(stripMoment(a)).toBe(new Date(CHRISTMAS).getTime())
    expect(stripMoment(b)).toBe(new Date(MAYDAY).getTime())
  })

  it('renders two different tide instants as two different pages', async () => {
    const a = await body(`/tides/us/wa/seattle/${CHRISTMAS}`)
    const b = await body(`/tides/us/wa/seattle/${MAYDAY}`)
    expect(a).not.toBe(b)
    expect(a).toContain(dayLabel(new Date(CHRISTMAS), SEATTLE.timezone))
    expect(b).toContain(dayLabel(new Date(MAYDAY), SEATTLE.timezone))
    expect(stripMoment(a)).toBe(new Date(CHRISTMAS).getTime())
    expect(stripMoment(b)).toBe(new Date(MAYDAY).getTime())
  })

  it('does not render the canonical page instead', async () => {
    // The canonical page freezes at the build clock for the server render. If
    // the instant route stops mounting again, that date is what comes back.
    const a = await body(`/currents/us/wa/deception-pass-narrows/${CHRISTMAS}`)
    const canonical = await body('/currents/us/wa/deception-pass-narrows')
    expect(a).not.toBe(canonical)
    expect(canonical).toContain(dayLabel(SERVER_NOW, DECEPTION.timezone))
    // The canonical strip opens on no shared moment: the server draws the
    // middle of its window and makes no reading.
    expect(stripMoment(canonical)).not.toBe(new Date(CHRISTMAS).getTime())
    expect(canonical).not.toMatch(/aria-valuetext="(Flooding|Ebbing|Slack)/)
  })

  it('sends the app\'s short share link to the same moment at the station\'s own path', async () => {
    // The app shares `/<kind>/<slug>/<instant>`; the page lives under its country.
    const { loadDirectory } = await import('./-directory')
    const sent = await loadDirectory('current', `deception-pass-narrows/${CHRISTMAS}`).catch((e) => e)
    expect(sent.options).toMatchObject({
      href: `/currents/us/wa/deception-pass-narrows/${CHRISTMAS}`,
      statusCode: 301,
    })
  })

  it('404s a malformed instant rather than rendering some other moment', async () => {
    const html = await body('/currents/us/wa/deception-pass-narrows/not-a-time')
    expect(html).toContain('Not published')
  })
})

describe('the App Store banner opens the station being read', () => {
  // The app reads only the flat share form, so that is the argument even
  // though the page lives at the nested path.
  async function banners(url: string) {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [url] }) })
    await router.load()
    const html = renderToString(<RouterProvider router={router} />)
    return [...html.matchAll(/<meta name="apple-itunes-app" content="([^"]*)"/g)].map((m) => m[1])
  }

  it('hands the app the station on a station page', async () => {
    expect(await banners('/tides/us/wa/seattle')).toEqual([
      'app-id=6813654837, app-argument=https://slackwater.xyz/tides/seattle/',
    ])
    expect(await banners('/currents/us/wa/deception-pass-narrows')).toEqual([
      'app-id=6813654837, app-argument=https://slackwater.xyz/currents/deception-pass-narrows/',
    ])
  })

  it('hands the app the shared moment on an instant page', async () => {
    expect(await banners('/currents/us/wa/deception-pass-narrows/2026-12-25T03:15-08:00')).toEqual([
      'app-id=6813654837, app-argument=https://slackwater.xyz/currents/deception-pass-narrows/2026-12-25T03:15-08:00',
    ])
  })

  it('keeps the bare banner on pages that are not a station', async () => {
    expect(await banners('/support')).toEqual(['app-id=6813654837'])
  })

  it('suppresses the inherited App Store banner for Beta-only Arran coverage', async () => {
    expect(await banners('/currents/ca/bc/arran-rapids')).toEqual([''])
    expect(await banners('/currents/ca/bc/arran-rapids/2026-12-25T03:15-08:00')).toEqual([''])
  })
})

describe('the server render claims nothing about now', () => {
  it('leaves the relative "in Xm" countdown to the hydrated client', async () => {
    for (const url of ['/currents/us/wa/deception-pass-narrows', '/currents/us/wa/deception-pass-narrows/2026-12-25T03:15-08:00']) {
      expect(await body(url), url).not.toMatch(/in \d+[hm]/)
    }
  })

  it('draws no now on the strip: no Today, no Now pill, no reading of the build clock', async () => {
    for (const url of ['/tides/us/wa/seattle', '/tides/us/wa/seattle/2026-12-25T03:15-08:00', '/currents/us/wa/deception-pass-narrows']) {
      const html = await body(url)
      expect(html, url).toContain('role="slider"')
      expect(html, url).not.toMatch(/>Today<|>Tomorrow<|>Yesterday<|Return to now/)
    }
    expect(await body('/tides/us/wa/seattle')).not.toMatch(/aria-valuetext="(Rising|Falling)/)
  })

  it('says nothing about the device that computed it', async () => {
    // "computed on this device" is false in prerendered HTML.
    expect(await body('/currents/us/wa/deception-pass-narrows')).not.toContain('this device')
  })
})
