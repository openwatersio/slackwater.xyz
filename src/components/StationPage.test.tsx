import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationPage } from './StationPage'
import type { BundledStation, ChsStation } from '#/lib/station'

const dodd = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.13546639419797, longitude: -123.81735084108287, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('StationPage for a CHS station', () => {
  const html = renderToStaticMarkup(
    <StationPage station={dodd} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('names the station', () => {
    expect(html).toContain('Dodd Narrows')
  })

  it('draws no curve', () => {
    expect(html).not.toContain('<svg')
  })

  it('claims no computation', () => {
    expect(html).not.toMatch(/comput/i)
  })

  it('does not claim the app works offline here', () => {
    // Nine of the 23 gates are never fitted on device, and nothing in the
    // published registry says which nine. Any offline claim is false for some
    // of them, so the page makes none.
    expect(html).not.toMatch(/offline/i)
  })

  it('still offers the app, which is why these pages exist', () => {
    expect(html).toMatch(/TestFlight|beta/i)
  })
})

describe('StationPage offers the CHS curve without fetching anything itself', () => {
  // What the Worker serves. Effects do not run here, which is the point: this
  // is the prerendered page, and it must carry no prediction whatever the
  // browser goes on to do with it.
  const html = renderToStaticMarkup(
    <StationPage station={dodd} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('serves no control for a request that has not started', () => {
    // The browser asks DFO on load, but only once it is a browser: the fetch
    // and every control belonging to it live behind an effect. So the page we
    // SERVE is the identity page #43 shipped. A reader with JS off, or one
    // whose hydration failed, must not be shown a Cancel button for a request
    // that is not happening, or told in the present tense about a fetch that
    // never started.
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/cancel|your browser/i)
  })

  it('still names the source of the numbers it does not have', () => {
    expect(html).toMatch(/Canadian Hydrographic Service/)
  })

  it('keeps the identity panel saying exactly what it said', () => {
    // #44: the panel claims coverage and a source and no mechanism, because
    // nothing published says which gates the app fits. Drawing a curve does
    // not relax that for the panel — only for the curve's own caption.
    expect(html).toContain('are based on Canadian Hydrographic Service data')
    expect(html).not.toContain('published by the Canadian Hydrographic Service')
  })

  it('prerenders no curve at all', () => {
    // The licensing rule, and the one that did not move: nothing we serve may
    // contain a CHS prediction. Fetching on load changes who starts the
    // request, not who serves the numbers.
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('published by the Canadian Hydrographic Service')
  })
})

describe('StationPage for a derived gate', () => {
  // chs-malibu-rapids has no CHS current station of its own: slack is the
  // reference port's high and low water plus a fixed lag. There is nothing to
  // fetch, so offering a button that could only fail is worse than offering
  // none.
  const malibu = {
    ...dodd,
    id: 'chs-malibu-rapids', slug: 'malibu-rapids', name: 'Malibu Rapids',
    region: 'Princess Louisa Inlet',
    latitude: 50.1626, longitude: -123.8515,
    derived: true,
  } satisfies ChsStation
  const html = renderToStaticMarkup(
    <StationPage station={malibu} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('starts no request, and offers no button it cannot honour', () => {
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/cancel|your browser/i)
  })

  it('still names the water and offers the app', () => {
    expect(html).toContain('Malibu Rapids')
    expect(html).toMatch(/TestFlight|beta/i)
  })
})

describe('StationPage for a CHS tide port', () => {
  const victoria = {
    id: 'chs-victoria', kind: 'tide', slug: 'victoria', name: 'Victoria',
    source: 'chs', region: 'Inner Harbour',
    latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
  } satisfies ChsStation
  const html = renderToStaticMarkup(
    <StationPage station={victoria} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('prerenders no curve, exactly as a gate does not', () => {
    // The licensing rule does not care which kind of water it is: nothing we
    // serve may contain a CHS prediction.
    expect(html).not.toContain('<svg')
    expect(html).not.toMatch(/Chart datum|published by the Canadian/)
  })

  it('serves no control for a request that has not started', () => {
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/cancel|your browser/i)
  })

  it('names the water and its region, and offers the app', () => {
    expect(html).toContain('Victoria')
    expect(html).toContain('Inner Harbour')
    expect(html).toMatch(/TestFlight|beta/i)
  })

  it('claims no computation and no offline capability', () => {
    expect(html).not.toMatch(/comput/i)
    expect(html).not.toMatch(/offline/i)
  })
})

describe('StationPage for a bundled tide station', () => {
  const seattle: BundledStation = {
    id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'Seattle',
    latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
    source: 'bundled', chartDatum: 'MLLW', state: 'WA', country: 'United States',
    constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
  }
  const now = new Date('2026-09-11T20:00:00Z')
  const nearby = [
    { slug: 'tacoma', name: 'Tacoma', latitude: 47.27, longitude: -122.41, nm: 20.1, bearing: 190 },
  ]
  const html = renderToStaticMarkup(<StationPage station={seattle} now={now} nearby={nearby} />)
  const live = renderToStaticMarkup(<StationPage station={seattle} now={now} live nearby={nearby} />)

  it('leads with the query: the station, the words, the place', () => {
    expect(html).toContain('<h1')
    expect(html).toContain('Seattle tide times &amp; tide chart — WA, United States')
  })

  it('walks a breadcrumb of real pages, home first', () => {
    expect(html).toMatch(/<nav aria-label="Breadcrumb"/)
    expect(html).toMatch(/<a href="\/"/)
    expect(html).toMatch(/<a href="\/stations\/tides\/"/)
  })

  it("answers first, dated, in HTML that is true whenever it is read", () => {
    // The day's turns in order, on the station's own calendar.
    const answer = html.match(/<p class="mt-6[^"]*">(.*?)<\/p>/)![1]
    expect(answer).toMatch(/^<span[^>]*>Fri 11 Sep 2026<\/span>/)
    expect(answer).toMatch(/High \d+\.\d ft at (<[^>]+>)?\d\d:\d\d/)
    expect(answer).toMatch(/Low -?\d+\.\d ft at (<[^>]+>)?\d\d:\d\d/)
    expect(html).not.toMatch(/in \d+[hm]\b/)
    expect(html).not.toMatch(/Rising|Falling/)
  })

  it('reads the water now only once the clock is live', () => {
    expect(live).toMatch(/Rising|Falling/)
    expect(live).toMatch(/(High|Low) in \d+(h \d+)?m/)
  })

  it('carries today and tomorrow, both in the HTML, on two radio tabs', () => {
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html.match(/<path[^>]+d="M[\d.,\-L\s]+"/g)!.length).toBeGreaterThanOrEqual(2)
    // Dates, not "Today": a prerender's today is the build day.
    expect(html).toContain('Fri 11 Sep 2026')
    expect(html).toContain('Sat 12 Sep 2026')
    expect(html).not.toMatch(/>Today</)
    expect(live).toMatch(/>Today</)
    expect(live).toMatch(/>Tomorrow</)
  })

  it('tables a week of highs and lows, grouped by day', () => {
    expect(html).toContain('<table')
    expect(html).toContain('Tide times for the next 7 days')
    for (let d = 11; d <= 17; d++) expect(html).toContain(`${d} Sep 2026`)
  })

  it('states the datum under Station facts, not under the curve', () => {
    expect(html).toContain('Station facts')
    expect(html).toContain('MLLW datum')
    expect(html).toMatch(/A negative height means there is that much less water/)
    expect(html.match(/MLLW datum/g)).toHaveLength(1)
    expect(html).toContain('47.6000° N, 122.3400° W')
  })

  it('links each neighbour with its leg, and leaves the map to the browser', () => {
    expect(html).toMatch(/<a href="\/tides\/tacoma\/"[^>]*>Tacoma<\/a>/)
    expect(html).toContain('20.1 nm S')
    expect(html).not.toContain('leaflet')
    expect(html).not.toContain('tile.openstreetmap.org')
  })
})
