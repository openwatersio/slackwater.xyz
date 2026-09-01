import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TideCurve } from './TideCurve'
import type { BundledStation } from '#/lib/station'

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
