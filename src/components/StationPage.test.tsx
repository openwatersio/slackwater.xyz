import { beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { covers, restingPlace, StationPage, stripAnchor } from './StationPage'
import { loadCatalogue } from '#/lib/catalogue'
import { dayStart } from '#/lib/format'
import { fetchPortTides, gateEvents, signedSamples } from '#/lib/iwls'
import gateFixture from '#/lib/__fixtures__/iwls.json' with { type: 'json' }
import portFixture from '#/lib/__fixtures__/iwls-ports.json' with { type: 'json' }
import { fetchRefinement } from '#/lib/refine'
import { DAY_BEFORE, DAY_OF, dfoDay, MIDNIGHT_HIGH, MIDNIGHT_PORT, SEAM_DAY, SEAM_END, SEAM_HIGH, SEAM_PORT } from '#/lib/__fixtures__/seam'
import { height, hhmm } from '#/lib/format'
import { SEAM_TWIN_MS } from '#/lib/readings'
import { tideExtremes } from '#/lib/predict'
import type { Refined } from '#/lib/refine'
import type { BundledStation, ChsStation } from '#/lib/station'

/** The strip's own markup: from its slider to the line under the page's charts. */
const strip = (html: string) => {
  const from = html.indexOf('role="slider"')
  expect(from, 'the page draws a strip').toBeGreaterThan(-1)
  return html.slice(from, html.indexOf('Predictions are not observations'))
}

/** The strip's slider: its window, the moment it is on, and that moment spoken. */
const slider = (html: string) => {
  const tag = html.match(/<div role="slider"[^>]*>/)![0]
  const attr = (name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]
  return {
    min: Number(attr('aria-valuemin')),
    max: Number(attr('aria-valuemax')),
    now: Number(attr('aria-valuenow')),
    text: attr('aria-valuetext') ?? '',
  }
}

const dodd = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  path: '/currents/ca/bc/dodd-narrows/',
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

  it('links the slack water guide without a slack table to sit beside', () => {
    expect(html).toContain('href="/learn/slack-water/"')
  })

  it('claims no computation', () => {
    expect(html).not.toMatch(/comput/i)
  })

  it('does not claim the app works offline here', () => {
    // Shared coverage copy cannot promise offline predictions for online gates (#44).
    expect(html).not.toMatch(/offline/i)
  })

  it('still offers the app, which is why these pages exist', () => {
    expect(html).toContain('https://apps.apple.com/app/slackwater-tides-current/id6813654837')
    expect(html).toContain('Requires iOS 26 or later.')
  })

  it('offers Arran coverage through the beta rather than the App Store', () => {
    const arran = loadCatalogue().find((station) => station.path === '/currents/ca/bc/arran-rapids/')!
    expect(arran).toBeDefined()
    const page = renderToStaticMarkup(<StationPage station={arran} now={new Date('2026-09-01T12:00:00Z')} />)
    expect(page).toContain('href="https://testflight.apple.com/join/5gwh791N"')
    expect(page).toContain('Join the TestFlight beta')
    expect(page).toContain('available in the Slackwater beta')
    expect(page).not.toContain('Slackwater covers this water in the app.')
    expect(page).not.toContain('https://apps.apple.com/app/slackwater-tides-current/id6813654837')
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

describe('StationPage once a CHS-only day has arrived', () => {
  // What the reader's browser shows after `ChsGate`'s fetch lands: one
  // bounded strip of DFO's day, credited under it.
  const at = new Date('2026-09-01T06:00:00Z')

  describe('for a port', () => {
    const victoria = {
      id: 'chs-victoria', kind: 'tide', slug: 'victoria', name: 'Victoria',
      path: '/tides/ca/bc/victoria/',
      source: 'chs', region: 'Inner Harbour',
      latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
    } satisfies ChsStation
    const port = portFixture.ports['Victoria Harbour']
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      const body = url.includes('/stations?') ? portFixture.stations : url.includes('wlp-hilo') ? port['wlp-hilo'] : port.wlp
      return { ok: true, json: async () => body } as Response
    }
    let html = ''
    beforeAll(async () => {
      const day = await fetchPortTides(victoria, new Date('2026-09-01T00:00:00Z'), 24, fetcher)
      html = renderToStaticMarkup(
        <StationPage station={victoria} now={at} live settled fetched={{ kind: 'tide', ...day }} />,
      )
    })

    it("draws DFO's day on one strip in place of the identity panel", () => {
      expect(html.match(/role="slider"/g)).toHaveLength(1)
      expect(strip(html)).toContain('>6:45 AM<')
      expect(html).not.toContain('are based on Canadian Hydrographic Service data')
    })

    it('names chart datum, and no code it would be wrong about', () => {
      // Victoria's own LLWLT is -0.09 m, nine centimetres below the zero these
      // heights are quoted from, so borrowing the corpus's datum vocabulary
      // would be a precise claim and a false one.
      expect(html).toContain('Chart datum · published by the Canadian Hydrographic Service')
      expect(html).not.toMatch(/LLWLT|MLLW|LAT datum/)
    })

    it('claims no computation', () => {
      expect(html).not.toMatch(/comput/i)
    })

    it('prints the day, which a CHS-only page has no 7-day table to carry onto paper', () => {
      const wrapper = html.match(/<div class="([^"]*)"><div class="relative select-none/)![1]
      expect(wrapper).not.toContain('print:hidden')
      // White ink on the strip's own ground: a printer must not drop it.
      expect(wrapper).toContain('[print-color-adjust:exact]')
    })
  })

  describe('for a gate', () => {
    const gate = gateFixture.gates['Dodd Narrows']
    const html = renderToStaticMarkup(
      <StationPage station={dodd} now={at} live settled fetched={{
        kind: 'current',
        samples: signedSamples(gate.wcsp1, gate.wcdp1, gate.floodDirection),
        events: gateEvents(gate['wcp1-events']),
      }} />,
    )

    it("prints DFO's published peaks on the strip", () => {
      expect(strip(html)).toContain('7.1')
      expect(strip(html)).toContain('7.0')
    })

    it('credits CHS once, under the strip', () => {
      expect(html.match(/fetched from DFO by your browser/g)).toHaveLength(1)
      expect(html).toContain('Predictions published by the Canadian Hydrographic Service, fetched from DFO by your browser.')
      expect(html).not.toMatch(/comput/i)
    })
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
    path: '/currents/ca/bc/malibu-rapids/',
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
    expect(html).toContain('https://apps.apple.com/app/slackwater-tides-current/id6813654837')
  })
})

describe('StationPage for a CHS tide port', () => {
  const victoria = {
    id: 'chs-victoria', kind: 'tide', slug: 'victoria', name: 'Victoria',
    path: '/tides/ca/bc/victoria/',
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
    expect(html).toContain('https://apps.apple.com/app/slackwater-tides-current/id6813654837')
  })

  it('claims no computation and no offline capability', () => {
    expect(html).not.toMatch(/comput/i)
    expect(html).not.toMatch(/offline/i)
  })
})

describe('StationPage for a computed port with a CHS layer', () => {
  // Victoria as the catalogue builds it: the provider row's constituents and
  // credit, the curated record's name and position, and the CHS identity the
  // browser resolves DFO's station from. The constituents are made up, so
  // every label that matches DFO's numbers can only have come from DFO; the
  // offset keeps them within `SEAM_STEP_LIMIT_FT` of DFO's day at its edges,
  // as a real merged port is, so the day is joined.
  const victoria: BundledStation = {
    id: 'ticon/victoria_bc-543a-can-uhslc_rq', kind: 'tide', slug: 'victoria', name: 'Victoria',
    path: '/tides/ca/bc/victoria/',
    latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
    source: 'bundled', chartDatum: 'LAT', state: 'BC', country: 'Canada', region: 'Inner Harbour',
    publisher: 'TICON-4',
    attribution: 'Slackwater database. Source: TICON-4. Licensed CC BY 4.0.',
    constituents: [{ name: 'M2', amplitude: 3, phase: 0 }, { name: 'K1', amplitude: 2, phase: 200 }],
    offset: 6,
    chs: { id: 'chs-victoria' },
  }
  const now = new Date('2026-09-01T12:00:00Z')
  const served = renderToStaticMarkup(<StationPage station={victoria} now={now} />)

  it('prerenders the computed curve and the week table a bundled page gets', () => {
    expect(served).toContain('<svg')
    expect(served).toContain('Tide times for the next 7 days')
    expect(served).toContain('Harmonic constituents from TICON-4')
    expect(served).toContain('Source: TICON-4. Licensed CC BY 4.0.')
  })

  it('serves no CHS prediction, and no control for a request that has not started', () => {
    expect(served).not.toMatch(/published by the Canadian Hydrographic Service|fetched from DFO/)
    expect(served).not.toMatch(/cancel|your browser/i)
  })

  it('makes no claim about how the app predicts this water (#44)', () => {
    expect(served).not.toMatch(/offline|on-device/i)
  })

  it("draws DFO's day over the computed one once the browser has it, and keeps the week computed", async () => {
    const port = portFixture.ports['Victoria Harbour']
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      const body = url.includes('/stations?')
        ? portFixture.stations
        : url.includes('wlp-hilo')
          ? port['wlp-hilo']
          : port.wlp
      return { ok: true, json: async () => body } as Response
    }
    const refined = await fetchRefinement(victoria, now, fetcher)
    const layered = renderToStaticMarkup(
      <StationPage station={victoria} now={now} live refined={refined} />,
    )
    // 13:45 and 18:53 UTC fall inside Victoria's local day; 2.021 and 1.688 m.
    expect(layered).toContain('6.6 ft')
    expect(layered).toContain('5.5 ft')
    expect(layered).toContain('published by the Canadian Hydrographic Service, on chart datum, fetched from DFO by your browser')
    expect(layered).toContain('Tide times for the next 7 days')
    expect(layered).toContain('Harmonic constituents from TICON-4')
  })

  it("draws DFO's published turns on the strip once the browser has them, and the computed ones until then", async () => {
    const port = portFixture.ports['Victoria Harbour']
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      const body = url.includes('/stations?') ? portFixture.stations : url.includes('wlp-hilo') ? port['wlp-hilo'] : port.wlp
      return { ok: true, json: async () => body } as Response
    }
    const refined = await fetchRefinement(victoria, now, fetcher)
    const layered = renderToStaticMarkup(<StationPage station={victoria} now={now} live refined={refined} />)
    const computed = renderToStaticMarkup(<StationPage station={victoria} now={now} live />)
    // 13:45 and 18:53 UTC are 6:45 AM and 11:53 AM in Victoria: 2.021 and
    // 1.688 m. The fixture's constituents are unlike Victoria's real tide, so
    // these labels can only have come from DFO.
    for (const label of ['>6:45 AM<', '>6.6<', '>11:53 AM<', '>5.5<']) {
      expect(strip(layered)).toContain(label)
      expect(strip(computed)).not.toContain(label)
    }
    // The strip keeps the whole window: CHS's day replaces one day of it.
    expect(slider(layered)).toMatchObject({ min: slider(computed).min, max: slider(computed).max })
  })

  describe("the week table's today rows", () => {
    const port = portFixture.ports['Victoria Harbour']
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      const body = url.includes('/stations?')
        ? portFixture.stations
        : url.includes('wlp-hilo')
          ? port['wlp-hilo']
          : port.wlp
      return { ok: true, json: async () => body } as Response
    }
    /** Each table row as [day, what, time, value, marked]. */
    const rows = (html: string) => {
      const table = html.match(/<table[\s\S]*?<\/table>/)![0]
      return [...table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].slice(1).map(([, attrs, row]) => {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(([, c]) => c)
        const marked = /data-source="chs"/.test(attrs) && />CHS<\/span>/.test(row)
        const text = cells.map((c) => c.replace(/<[^>]+>/g, '').replace(/CHS$/, '').trim())
        return [...text, marked] as [string, string, string, string, boolean]
      })
    }
    const today = 'Tue 1 Sep 2026'
    let layered = ''
    beforeAll(async () => {
      const refined = await fetchRefinement(victoria, now, fetcher)
      layered = renderToStaticMarkup(<StationPage station={victoria} now={now} live refined={refined} />)
    })

    it('are computed, and unmarked, in the page we serve', () => {
      const served = rows(renderToStaticMarkup(<StationPage station={victoria} now={now} />))
      expect(served.filter((r) => r[0] === today).length).toBeGreaterThan(0)
      expect(served.every((r) => !r[4])).toBe(true)
      expect(served.map((r) => r[3])).not.toContain('6.6 ft')
    })

    it("become DFO's published turns once the layer arrives, each marked", () => {
      // 07:29, 13:45 and 18:53 UTC: 00:29, 06:45 and 11:53 in Victoria.
      // 1.065, 2.021 and 1.688 m. 00:49 UTC is the evening before, local.
      // The recorded day is a UTC day, so DFO's samples stop at 17:00 local
      // and the computed evening high after them stands, unmarked.
      const ours = rows(layered).filter((r) => r[0] === today)
      expect(ours.filter((r) => r[4])).toEqual([
        [today, 'Low', '00:29', '3.5 ft', true],
        [today, 'High', '06:45', '6.6 ft', true],
        [today, 'Low', '11:53', '5.5 ft', true],
      ])
      expect(ours.filter((r) => !r[4]).every((r) => String(r[2]) > '17:00')).toBe(true)
    })

    it('leave every other day exactly as computed', () => {
      const served = rows(renderToStaticMarkup(<StationPage station={victoria} now={now} />))
      const notToday = (r: (string | boolean)[]) => r[0] !== today
      expect(rows(layered).filter(notToday)).toEqual(served.filter(notToday))
    })

    it('say which numbers are whose, in the table and under the chart', () => {
      const caption = layered.match(/<caption[^>]*>([\s\S]*?)<\/caption>/)![1]
      expect(caption).toContain('Rows marked CHS are predictions published by the Canadian Hydrographic Service')
      expect(caption).toContain('above chart datum')
      // The recorded day is a UTC day, so DFO's samples end at 17:00 local
      // and the credit names exactly those hours.
      expect(layered.replaceAll('&#x27;', "'")).toContain(
        "Today's curve from 00:00 to 17:00 and the rows marked CHS in the 7-day table: predictions published by the Canadian Hydrographic Service",
      )
      expect(layered.replaceAll('&#x27;', "'")).toContain(
        "fetched from DFO by your browser. The computed curve is eased onto CHS's for twelve hours either side of its day. " +
          'Everything else is computed from harmonic constituents.',
      )
      expect(layered).not.toMatch(/offline|on-device/i)
    })

    it('take only the hours DFO actually sent', async () => {
      // A short answer: DFO's samples stop at local 06:00, so its 06:45 high
      // and 11:53 low are past what it covered and the computed rows stand.
      const refined = await fetchRefinement(victoria, now, fetcher)
      const cut = new Date('2026-09-01T13:00:00Z').getTime()
      const short = { ...refined, samples: refined.samples.filter((s) => s.time.getTime() <= cut) }
      const page = rows(renderToStaticMarkup(<StationPage station={victoria} now={now} live refined={short} />))
      const served = rows(renderToStaticMarkup(<StationPage station={victoria} now={now} />))
      const ours = page.filter((r) => r[0] === today)
      expect(ours.filter((r) => r[4])).toEqual([[today, 'Low', '00:29', '3.5 ft', true]])
      const later = (r: (string | boolean)[]) => r[0] === today && String(r[2]) > '06:00'
      expect(page.filter(later)).toEqual(served.filter(later))
    })

    it('credit only the hours DFO sent under the strip', async () => {
      const refined = await fetchRefinement(victoria, now, fetcher)
      const cut = new Date('2026-09-01T13:00:00Z').getTime()
      const short = { ...refined, samples: refined.samples.filter((s) => s.time.getTime() <= cut) }
      const page = renderToStaticMarkup(<StationPage station={victoria} now={now} live refined={short} />).replaceAll('&#x27;', "'")
      expect(page).toContain("Today's curve from 00:00 to 06:00 and the rows marked CHS")
    })

    it('stop calling DFO’s day today once the reader’s day has moved on', async () => {
      // A page left open past midnight keeps the day it fetched. The table
      // follows the reader onto the new day and marks no rows CHS; the credit
      // names the day DFO covered and mentions no rows.
      const refined = await fetchRefinement(victoria, now, fetcher)
      const tomorrow = new Date('2026-09-02T17:00:00Z')
      const page = renderToStaticMarkup(<StationPage station={victoria} now={tomorrow} live refined={refined} />).replaceAll('&#x27;', "'")
      expect(page).toContain('The curve from 00:00 to 17:00 on Tue 1 Sep 2026: predictions published by the Canadian Hydrographic Service')
      expect(page).not.toContain("Today's curve")
      expect(page).not.toContain('data-source="chs"')
      expect(page).not.toContain('Rows marked CHS')
    })

    it("stay off a shared moment's week, and its strip, when CHS's day lies outside both", async () => {
      // The browser fetches the reader's own day whatever the URL shares. A
      // moment three weeks on has none of that day in its window.
      const refined = await fetchRefinement(victoria, now, fetcher)
      const later = new Date('2026-09-22T12:00:00Z')
      const shared = renderToStaticMarkup(<StationPage station={victoria} now={now} selectedAt={later} live refined={refined} />)
      const plain = renderToStaticMarkup(<StationPage station={victoria} now={now} selectedAt={later} live />)
      expect(rows(shared)).toEqual(rows(plain))
      expect(strip(shared)).toBe(strip(plain))
      expect(shared).not.toContain('fetched from DFO by your browser')
    })

    it('keep the served caption free of any CHS claim', () => {
      const served = renderToStaticMarkup(<StationPage station={victoria} now={now} />)
      expect(served.match(/<caption[^>]*>([\s\S]*?)<\/caption>/)![1]).not.toMatch(/CHS|Canadian Hydrographic/)
    })
  })
})

describe('StationPage for a bundled tide station', () => {
  const seattle: BundledStation = {
    id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'Seattle',
    path: '/tides/us/wa/seattle/',
    latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
    source: 'bundled', chartDatum: 'MLLW', state: 'WA', country: 'United States',
    constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
  }
  const now = new Date('2026-09-11T20:00:00Z')
  const nearby = [
    { slug: 'tacoma', name: 'Tacoma', path: '/tides/us/wa/tacoma/', latitude: 47.27, longitude: -122.41, nm: 20.1, bearing: 190 },
  ]
  const html = renderToStaticMarkup(<StationPage station={seattle} now={now} nearby={nearby} />)
  const live = renderToStaticMarkup(<StationPage station={seattle} now={now} live nearby={nearby} />)

  it('keeps the visible heading short while the page title carries the search query', () => {
    expect(html).toMatch(/<h1[^>]*>Seattle — WA, United States<\/h1>/)
    expect(html).toContain('Tide times &amp; tide chart')
    expect(html).not.toContain('/learn/slack-water/')
    expect(html).not.toMatch(/<h1[^>]*>[^<]*tide times/i)
  })

  it('walks a breadcrumb of real pages, home first', () => {
    expect(html).toMatch(/<nav aria-label="Breadcrumb"/)
    expect(html).toMatch(/<a href="\/"/)
    expect(html).toMatch(/<a href="\/tides\/"/)
  })

  it('draws one strip and no day pager', () => {
    expect(html.match(/role="slider"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Tide timeline"')
    expect(html).not.toMatch(/aria-label="Choose tide day"|>Yesterday<|>Tomorrow</)
  })

  it("loads 96 hours before to 180 hours after the station-local start of the page's day", () => {
    const day = dayStart(now, seattle.timezone).getTime()
    expect(slider(html)).toMatchObject({ min: day - 96 * 3600_000, max: day + 180 * 3600_000 })
  })

  it('claims nothing about now in the page we serve', () => {
    // No `now` for the strip until the clock is the reader's: no reading, no
    // Today, no Now pill, nothing relative to a build clock.
    const served = strip(html)
    expect(served).not.toMatch(/Rising|Falling|Today|Return to now/)
    expect(served).not.toMatch(/\bin \d+[hm]/)
  })

  it('reads the water now only once the clock is live', () => {
    const reading = strip(live)
    expect(reading).toMatch(/Rising|Falling/)
    expect(reading).toContain('>Today<')
    expect(slider(live).now).toBe(now.getTime())
  })

  it('opens a shared moment with its reading, in the HTML we serve as well', () => {
    const selectedAt = new Date('2026-09-12T22:00:00Z')
    const shared = renderToStaticMarkup(<StationPage station={seattle} now={now} selectedAt={selectedAt} nearby={nearby} />)
    expect(slider(shared).now).toBe(selectedAt.getTime())
    expect(slider(shared).text).toMatch(/^(Rising|Falling) .*Sep 12, 3:00 PM PDT$/)
    // Still no claim about the reader's present.
    expect(strip(shared)).not.toMatch(/Today|Return to now/)
    // The table starts on the shared moment's day.
    expect(shared).toContain('Sat 12 Sep 2026 through Fri 18 Sep 2026.')
  })

  it('keeps a shared selection separate from actual now', () => {
    const shared = renderToStaticMarkup(
      <StationPage
        station={seattle}
        now={new Date('2026-09-12T22:00:00Z')}
        selectedAt={now}
        live
        nearby={nearby}
      />,
    )
    expect(slider(shared).now).toBe(now.getTime())
    expect(slider(shared).text).toContain('Sep 11, 1:00 PM PDT')
    expect(shared).toContain('aria-label="Return to now"')
  })

  it('tables a week of highs and lows, grouped by day', () => {
    expect(html).toContain('<table')
    expect(html).toContain('Tide times for the next 7 days')
    for (let d = 11; d <= 17; d++) expect(html).toContain(`${d} Sep 2026`)
  })

  it.each([
    ['2026-12-31T20:00:00Z', 'Thu 31 Dec 2026', 'Wed 6 Jan 2027'],
    ['2026-11-01T20:00:00Z', 'Sun 1 Nov 2026', 'Sat 7 Nov 2026'],
  ])('keeps each extracted event dated across %s', (instant, firstDay, lastDay) => {
    const page = renderToStaticMarkup(<StationPage station={seattle} now={new Date(instant)} />)
    const table = page.match(/<table[\s\S]*?<\/table>/)![0]
    const caption = table.match(/<caption[^>]*>([\s\S]*?)<\/caption>/)?.[1]
    expect(caption).toContain(firstDay)
    expect(caption).toContain(lastDay)
    expect(caption).toContain('America/Los_Angeles')
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1)
    expect(rows.length).toBeGreaterThan(0)
    for (const [, row] of rows) {
      const date = row.match(/<td[^>]*>(.*?)<\/td>/)![1]
      expect(date).toMatch(/\w{3} \d{1,2} \w{3} 202[67]/)
      const time = row.match(/<time dateTime="([^"]+)"[^>]*>(\d{2}:\d{2})<\/time>/)
      expect(time).not.toBeNull()
      const local = new Date(time![1]).toLocaleTimeString('en-CA', {
        timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false,
      })
      expect(time![2]).toBe(local)
    }
  })

  it('credits the publisher and shows its licence notice', () => {
    const andenes = renderToStaticMarkup(<StationPage station={{
      ...seattle, id: 'kartverket/ANX', name: 'Andenes', chartDatum: 'CD',
      publisher: 'Kartverket / Norwegian Mapping Authority, Hydrographic Service',
      attribution: 'Slackwater database. Source: © Kartverket. Licensed CC BY 4.0.',
    }} now={now} />)
    expect(andenes).toContain('Harmonic constituents from Kartverket / Norwegian Mapping Authority, Hydrographic Service')
    expect(andenes).toContain('Source: © Kartverket. Licensed CC BY 4.0.')
  })

  it('states the datum under Station facts, not under the curve', () => {
    expect(html).toContain('Station facts')
    expect(html).toContain('MLLW datum')
    expect(html).toMatch(/A negative height means there is that much less water/)
    expect(html.match(/MLLW datum/g)).toHaveLength(1)
    expect(html).toContain('47.6000° N, 122.3400° W')
  })

  it('links each neighbour with its leg, and leaves the map to the browser', () => {
    expect(html).toMatch(/<a href="\/tides\/us\/wa\/tacoma\/"[^>]*>Tacoma<\/a>/)
    expect(html).toContain('20.1 nm S')
    expect(html).not.toContain('leaflet')
    expect(html).not.toContain('tile.openstreetmap.org')
  })
})

describe('StationPage for a bundled current station', () => {
  const station: BundledStation = {
    id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
    path: '/currents/us/wa/deception-pass-narrows/',
    latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
    source: 'bundled', floodDirection: 101.5, ebbDirection: 281.5,
    constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
  }
  const selected = new Date('2026-09-11T20:00:00Z')
  const actualNow = new Date('2026-09-11T22:00:00Z')

  it('opens a shared current selection and keeps Now separate', () => {
    const html = renderToStaticMarkup(
      <StationPage station={station} now={actualNow} selectedAt={selected} live />,
    )
    expect(html).not.toContain('aria-label="Choose current day"')
    expect(html).toContain('aria-label="Current timeline"')
    expect(slider(html).now).toBe(selected.getTime())
    expect(slider(html).text).toContain('Sep 11, 1:00 PM PDT')
    expect(html).toContain('aria-label="Return to now"')
    expect(html).toContain('Slack water and maximums for the next 7 days')
  })

  it('claims nothing about now in the page we serve', () => {
    const served = strip(renderToStaticMarkup(<StationPage station={station} now={actualNow} />))
    expect(served).not.toMatch(/Flooding|Ebbing|Today|Return to now/)
    expect(served).not.toMatch(/\bin \d+[hm]/)
  })

  it('sends a reader who meets the slack table to the slack water guide', () => {
    const html = renderToStaticMarkup(<StationPage station={station} now={actualNow} />)
    const table = html.match(/<table[\s\S]*?<\/table>/)![0]
    expect(table).toContain('href="/learn/slack-water/"')
  })

  it('names a subordinate current table reduction in the station facts', () => {
    const subordinate: BundledStation = {
      ...station,
      id: 'noaa/ACT0091',
      constituents: [],
      reduction: {
        referenceId: 'noaa/EPT0003@11',
        referenceConstituents: station.constituents,
        referenceOffset: 0,
        slackBeforeFloodOffset: 0, slackBeforeEbbOffset: 0,
        floodTimeOffset: 0, ebbTimeOffset: 0,
        floodSpeedRatio: 1.2, ebbSpeedRatio: 1.2,
      },
    }
    const html = renderToStaticMarkup(<StationPage station={subordinate} now={actualNow} />)
    expect(html).toContain('NOAA current table reduction from EPT0003, bin 11')
  })
})

describe("the 7-day table at the seam where CHS's day meets the computed rows", () => {
  // See `__fixtures__/seam.ts`: DFO lists a high six minutes before the end of
  // its hours, and the computed one falls two minutes after it.
  const page = renderToStaticMarkup(
    <StationPage station={SEAM_PORT} now={SEAM_DAY.start} selectedAt={SEAM_DAY.start} live refined={SEAM_DAY} />,
  )
  const table = page.match(/<table[\s\S]*?<\/table>/)![0]
  const rows = [...table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].slice(1).map(([, attrs, row]) => ({
    time: Date.parse(row.match(/<time dateTime="([^"]+)"/)![1]),
    what: row.match(/<td[^>]*>[^<]*<\/td><td[^>]*>([^<]*)<\/td>/)![1],
    value: row.match(/(-?[\d.]+) ft/)?.[1],
    chs: /data-source="chs"/.test(attrs),
  }))

  it('lists each turn once: no computed High minutes from DFO’s own', () => {
    for (const what of ['High', 'Low']) {
      const times = rows.filter((r) => r.what === what).map((r) => r.time)
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThan(SEAM_TWIN_MS)
    }
    expect(rows.map((r) => r.time)).not.toContain(SEAM_HIGH.time.getTime())
  })

  it('prints DFO’s heights exactly as published', () => {
    const inside = SEAM_DAY.turns.filter((t) => t.time.getTime() < SEAM_END)
    expect(rows.filter((r) => r.chs).map((r) => [r.time, r.value])).toEqual(
      inside.map((t) => [t.time.getTime(), t.level.toFixed(1).replace(/^-0\.0$/, '0.0')]),
    )
  })

  const pageWith = (refined?: Refined) =>
    renderToStaticMarkup(<StationPage station={SEAM_PORT} now={SEAM_DAY.start} selectedAt={SEAM_DAY.start} live refined={refined} />)
      .replaceAll('&#x27;', "'")

  it('says the curve was eased where it was joined', () => {
    expect(pageWith(SEAM_DAY)).toContain("The computed curve is eased onto CHS's for twelve hours either side of its day.")
  })

  it('shows a day stepping past the cap exactly as computed: no CHS rows, no CHS credit', () => {
    // Five feet at the edges, past every merged port's measured step but
    // Mill Bay's: the page draws and tables the computed day as if DFO's had
    // not arrived.
    const capped = pageWith(dfoDay(SEAM_PORT, SEAM_DAY.start, 21, -5))
    expect(capped).toBe(pageWith())
    expect(capped).not.toContain('data-source="chs"')
    expect(capped).not.toContain('fetched from DFO by your browser')
  })

  it('agrees with the strip on every turn it shows', () => {
    const strip = page.slice(page.indexOf('role="slider"'), page.indexOf('Predictions are not observations'))
    for (const r of rows.filter((row) => row.chs)) {
      expect(strip).toContain(`>${r.value}<`)
    }
  })
})

describe('the 7-day table at a midnight seam', () => {
  // See `__fixtures__/seam.ts`: a computed high three minutes past midnight on
  // 3 September, whose DFO twin falls at 23:57 on the 2nd.
  const tableOf = (selectedAt: Date, refined: Refined) => {
    const page = renderToStaticMarkup(
      <StationPage station={MIDNIGHT_PORT} now={selectedAt} selectedAt={selectedAt} live refined={refined} />,
    )
    const table = page.match(/<table[\s\S]*?<\/table>/)![0]
    return [...table.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].slice(1).map(([, attrs, row]) => ({
      time: Date.parse(row.match(/<time dateTime="([^"]+)"/)![1]),
      value: row.match(/(-?[\d.]+) ft/)?.[1],
      chs: /data-source="chs"/.test(attrs),
    }))
  }

  it('gives no CHS credit when the strip’s window holds only the ease beside DFO’s day', () => {
    // Shared five days after DFO's 2 September: the window opens at midnight
    // on the 3rd, as DFO's day ends, so no DFO point is on the strip, only
    // the computed curve eased onto it.
    const page = renderToStaticMarkup(
      <StationPage station={MIDNIGHT_PORT} now={DAY_BEFORE.start} selectedAt={new Date('2026-09-07T12:00:00Z')} live refined={DAY_BEFORE} />,
    ).replaceAll('&#x27;', "'")
    expect(page).toContain(
      "Beside Wed 2 Sep 2026, the computed curve is eased onto the Canadian Hydrographic Service's predictions for that day.",
    )
    expect(page).not.toContain('predictions published by the Canadian Hydrographic Service')
  })

  it('credits only the slice of DFO’s day a daylight-saving shift brings into the window, and the one eased side in view', () => {
    // Shared for 12 March in Los Angeles: 96 hours back crosses the spring
    // change, so the window opens at 23:00 on the 7th, inside DFO's day.
    const port = { ...SEAM_PORT, id: 'ticon/dst-slice', timezone: 'America/Los_Angeles' }
    const day = dfoDay(port, new Date('2026-03-07T08:00:00Z'), 24)
    const page = renderToStaticMarkup(
      <StationPage station={port} now={new Date('2026-03-07T20:00:00Z')} selectedAt={new Date('2026-03-12T19:00:00Z')} live refined={day} />,
    ).replaceAll('&#x27;', "'")
    expect(page).toContain("Today's curve from 23:00 to 23:45: predictions published by the Canadian Hydrographic Service")
    expect(page).toContain("The computed curve is eased onto CHS's for twelve hours after its day.")
    expect(page).not.toContain('either side')
  })

  it('says under the strip that a computed high kept inside DFO’s day is computed', () => {
    const page = renderToStaticMarkup(
      <StationPage station={MIDNIGHT_PORT} now={DAY_OF.start} selectedAt={new Date('2026-09-03T12:00:00Z')} live refined={DAY_OF} />,
    )
    expect(page).toContain(`The high at ${hhmm(MIDNIGHT_HIGH.time, 'UTC')} is computed.`)
  })

  it('keeps the computed high just inside DFO’s day when DFO listed no twin for it', () => {
    const rows = tableOf(new Date('2026-09-03T12:00:00Z'), DAY_OF)
    expect(rows.find((r) => r.time === +MIDNIGHT_HIGH.time)).toEqual({
      time: +MIDNIGHT_HIGH.time,
      value: height(MIDNIGHT_HIGH.level),
      chs: false,
    })
  })

  it('drops the same duplicate the strip drops when the page rests on the day after DFO’s', () => {
    // The week starts at midnight on the 3rd, where DFO's 2nd has just ended.
    const rows = tableOf(new Date('2026-09-03T12:00:00Z'), DAY_BEFORE)
    expect(rows.map((r) => r.time)).not.toContain(+MIDNIGHT_HIGH.time)
    expect(rows.some((r) => r.chs)).toBe(false)
  })

  it('prints a computed turn beside the seam at its own computed height, which its credit names', () => {
    // A computed high 47 minutes before DFO's 2 September begins, inside the
    // strip's ease, with no DFO twin.
    const computed = tideExtremes(MIDNIGHT_PORT, new Date('2026-09-01T21:00:00Z'), 3).find((e) => e.high)!
    const rows = tableOf(new Date('2026-09-01T12:00:00Z'), DAY_BEFORE)
    expect(rows.find((r) => r.time === +computed.time)).toEqual({
      time: +computed.time,
      value: height(computed.level),
      chs: false,
    })
  })
})

describe("the strip's window", () => {
  const H = 3600_000
  const shared = Date.parse('2026-09-01T07:00:00Z')

  /** The anchor for a reader whose clock reads `hours` after the shared day's start. */
  const at = (hours: number, following = true) => {
    const now = shared + hours * H
    const today = shared + Math.floor(hours / 24) * 24 * H
    return stripAnchor(shared, now, today, following)
  }

  it('moves to the reader’s day when Now is pressed on a shared moment the window cannot reach', () => {
    // Shared for September 1, opened September 22: the window ends September 8.
    expect(at(21 * 24 + 5)).toBe(shared + 21 * 24 * H)
  })

  it('stays put while the page is about a moment of its own', () => {
    expect(at(21 * 24 + 5, false)).toBe(shared)
  })

  it('stays put while the strip can centre the reader’s clock, so Now glides rather than remounts', () => {
    expect(at(3 * 24)).toBe(shared)
    expect(at(-2 * 24)).toBe(shared)
    // 160 hours on is the last moment a 40-hour-wide strip can centre.
    expect(at(159)).toBe(shared)
  })

  it('moves before the reader’s clock passes the last moment the widest strip can centre', () => {
    // Six days on at 18:00: inside the window, past where a desktop strip can
    // put it under the reading line.
    expect(at(6 * 24 + 18)).toBe(shared + 6 * 24 * H)
    expect(at(-77)).toBe(shared - 4 * 24 * H)
  })
})

describe("whether a CHS-only day reaches now", () => {
  const day = [0, 12, 24].map((h) => ({ time: new Date(Date.parse('2026-09-01T07:00:00Z') + h * 3600_000) }))

  it('does within the samples DFO sent, ends included', () => {
    expect(covers(day, Date.parse('2026-09-01T07:00:00Z'))).toBe(true)
    expect(covers(day, Date.parse('2026-09-02T07:00:00Z'))).toBe(true)
  })

  it('does not a day later, so Now loads the station page rather than resting on the end of the shared day', () => {
    expect(covers(day, Date.parse('2026-09-02T07:01:00Z'))).toBe(false)
    expect(covers([], Date.parse('2026-09-01T12:00:00Z'))).toBe(false)
  })
})

describe('where a resting strip puts the page', () => {
  const seattle = { path: '/tides/us/wa/seattle/', timezone: 'America/Los_Angeles' } as BundledStation
  const clock = Date.parse('2026-09-11T20:00:00Z')

  it('keeps the canonical path, following now, at now', () => {
    expect(restingPlace(seattle, clock + 60_000, clock)).toEqual({ path: '/tides/us/wa/seattle/' })
  })

  it('names the instant, and makes it what the 7-day table starts on, away from now', () => {
    const time = Date.parse('2026-09-13T17:30:00Z')
    expect(restingPlace(seattle, time, clock)).toEqual({
      path: '/tides/us/wa/seattle/2026-09-13T10:30-07:00',
      about: new Date(time),
    })
  })
})
