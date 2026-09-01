import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TideCurve } from './TideCurve'
import { fetchPortTides } from '#/lib/iwls'
import portFixture from '#/lib/__fixtures__/iwls-ports.json' with { type: 'json' }
import type { BundledStation, ChsStation } from '#/lib/station'

const SEATTLE: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled',
  // FEET. `@neaps/tide-database` ships Seattle's M2 as 1.063 METRES; the
  // catalogue converts once at the provider boundary (see catalogue.ts), so a
  // `Station` that reaches a renderer is already in the unit its labels claim.
  // These are those metre figures times 3.28084 — a fixture in metres would
  // make this file agree with a page that reads 3.28x shallow.
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}

describe('TideCurve', () => {
  const svg = renderToStaticMarkup(
    <TideCurve station={SEATTLE} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
  )

  it('draws a real path from the station it was given', () => {
    expect(svg).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
  })

  it('names its own station in the accessibility text', () => {
    expect(svg).toContain('SEATTLE (Madison St.), Elliott Bay')
    expect(svg).not.toContain('Deception Pass')
  })

  it('paints with attributes, not classes, so a rasteriser can render it', () => {
    // resvg cannot resolve Tailwind classes; a class-styled chart rasterises blank.
    expect(svg).toMatch(/(fill|stroke)="#[0-9A-Fa-f]{6}"/)
  })

  it('labels heights in feet, not the database metres', () => {
    // Seattle swings about 10 ft in a day. Rendered from the raw database
    // metres the same curve labels a ~3 ft swing — plausible-looking, wrong by
    // 3.28x, and the reason this assertion is a range and not a string.
    const m = svg.match(/High (-?[\d.]+) feet[\s\S]*?low (-?[\d.]+) feet/)
    expect(m, 'no high/low in the accessibility text').not.toBeNull()
    expect(Number(m![1]) - Number(m![2])).toBeGreaterThan(8)
  })

  it('uses no current-only visual language', () => {
    // Green means slack and slack is a current concept. A tide has no slack.
    expect(svg).not.toContain('#88B868')
  })
})

describe('TideCurve times', () => {
  // Force the host zone away from the station's, so a time formatted without an
  // explicit timeZone cannot accidentally come out right. The Worker renders
  // cards in UTC and a reader's browser in their own zone; both are wrong here.
  let saved: string | undefined
  beforeAll(() => {
    saved = process.env.TZ
    process.env.TZ = 'Asia/Tokyo'
  })
  afterAll(() => {
    process.env.TZ = saved
  })

  it('speaks the high and low in the station zone, not the running machine zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe(SEATTLE.timezone)
    const tokyoSvg = renderToStaticMarkup(
      <TideCurve station={SEATTLE} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
    )
    // America/Los_Angeles, not the Asia/Tokyo 12:40 / 19:50 the broken code gave.
    // Each extreme carries its own day: this window straddles local midnight,
    // so "at 03:50" alone would not say which day's low it is.
    expect(tokyoSvg).toContain(
      'High 6.2 feet on Mon 31 Aug 2026 at 20:40, low -4.4 feet on Tue 1 Sep 2026 at 03:50.',
    )
    expect(tokyoSvg).not.toContain('12:40')
  })
})

describe('TideCurve near zero', () => {
  // A Baltic-scale station: real, tiny, and the shape of the 33 pages in #34
  // that rendered a low of "-0.0 ft". The extremes land between -0.05 and 0,
  // where `toFixed(1)` puts a minus sign on a zero.
  const FLAT: BundledStation = {
    ...SEATTLE, id: 'noaa/0000000', slug: 'flat', name: 'Flat Water',
    constituents: [{ name: 'M2', amplitude: 0.03, phase: 10.8 }],
  }
  const svg = renderToStaticMarkup(
    <TideCurve station={FLAT} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
  )

  it('labels a hair below zero as 0.0, on the chart and in the spoken text', () => {
    // Both renders, not one: the chart label is what a reader sees and what the
    // OG card rasterises, the figcaption is what a screen reader says, and
    // fixing only the first leaves the page still saying "minus zero point zero".
    expect(svg).not.toContain('-0.0')
    expect(svg).toMatch(/low 0\.0 feet/)
  })

  it('still reports a low that is genuinely below datum', () => {
    // The guard strips a sign from zero, not from a station sitting under its
    // datum — those readings are true (#34 part 3) and must survive.
    //
    // Its own id: `predict.ts` caches predictors by station id, so a fixture
    // reusing FLAT's id gets FLAT's curve and this asserts nothing.
    const deep: BundledStation = { ...FLAT, id: 'noaa/0000001', constituents: [{ name: 'M2', amplitude: 1.2, phase: 10.8 }] }
    const deepSvg = renderToStaticMarkup(
      <TideCurve station={deep} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
    )
    expect(deepSvg).toMatch(/low -1\.2 feet/)
  })
})

describe('TideCurve datum', () => {
  // Its own id: `predict.ts` keys predictors on id + offset, and a fixture that
  // shares both with another would share its curve.
  const MLLW: BundledStation = {
    ...SEATTLE, id: 'noaa/9447131', slug: 'seattle-mllw', chartDatum: 'MLLW', offset: 6.64,
  }
  const svg = renderToStaticMarkup(
    <TideCurve station={MLLW} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
  )

  it('names the datum its heights are quoted against', () => {
    // A height with no datum on it is a number, not a depth. The app says the
    // same thing under its own chart.
    expect(svg).toContain('MLLW datum')
    expect(svg).toMatch(/A negative height means there is that much less water/)
  })

  it('says it in the accessible description too', () => {
    expect(svg).toMatch(/above MLLW/)
  })

  it('keeps the datum line out of the SVG, and so off the share card', () => {
    // `og-image.ts` rasterises the <svg> alone. Anything inside it lands on the
    // 1200x630 card, where the top-left already collides with the station name
    // (#26) — this line has no business competing for that space.
    const inner = svg.match(/<svg[\s\S]*<\/svg>/)![0]
    expect(inner).not.toContain('MLLW datum')
    expect(inner).not.toContain('negative height')
  })

  it('says nothing about a datum it was not given', () => {
    // The catalogue guarantees a datum for every tide station; if that ever
    // breaks, the page must go quiet rather than render "undefined datum".
    const bare = renderToStaticMarkup(
      <TideCurve station={SEATTLE} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
    )
    expect(bare).not.toContain('datum')
    expect(bare).not.toContain('undefined')
  })
})

describe('TideCurve with fetched samples', () => {
  // A Canadian port draws the same curve from numbers the reader's browser
  // fetched from DFO, rather than from constituents we may not re-serve.
  const VICTORIA: ChsStation = {
    id: 'chs-victoria', kind: 'tide', slug: 'victoria', name: 'Victoria',
    latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
    source: 'chs', region: 'Inner Harbour',
  }
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

  let svg = ''
  beforeAll(async () => {
    const day = await fetchPortTides(VICTORIA, new Date('2026-09-01T00:00:00Z'), 24, fetcher)
    svg = renderToStaticMarkup(
      <TideCurve
        station={VICTORIA} start={new Date('2026-09-01T00:00:00Z')} hours={24}
        now={new Date('2026-09-01T06:00:00Z')}
        samples={day.samples} high={day.high} low={day.low}
      />,
    )
  })

  it("prints DFO's published high and low in feet, at DFO's own minute", () => {
    // DFO publishes 2.544 m at 00:49 and 1.065 m at 07:29 for this day.
    // 8.3 ft and 3.5 ft in the station's zone: 17:49 and 00:29 PDT.
    // Rendered from the metres they arrived as, this page would read "2.5 ft"
    // — plausible, and wrong by 3.28x.
    expect(svg).toContain('8.3 ft')
    expect(svg).toContain('3.5 ft')
    expect(svg).toContain('17:49')
    expect(svg).toContain('00:29')
  })

  it('names chart datum, and no code it would be wrong about', () => {
    // Victoria's own LLWLT is -0.09 m, nine centimetres below the zero these
    // heights are quoted from, so borrowing the corpus's datum vocabulary
    // would be a precise claim and a false one.
    expect(svg).toContain('Chart datum · published by the Canadian Hydrographic Service')
    expect(svg).not.toMatch(/LLWLT|MLLW|LAT datum/)
  })

  it('claims nothing about computing it, or about the app', () => {
    expect(svg).not.toMatch(/harmonic constituents|offline|on-device/)
  })
})
