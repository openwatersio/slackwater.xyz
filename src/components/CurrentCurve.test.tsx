import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CurrentCurve } from './CurrentCurve'
import { gateEvents, signedSamples } from '#/lib/iwls'
import fixture from '#/lib/__fixtures__/iwls.json' with { type: 'json' }
import type { BundledStation, ChsStation } from '#/lib/station'

const DECEPTION: BundledStation = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  source: 'bundled',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
}

describe('CurrentCurve times', () => {
  // The runtime's zone must never leak into the labels: the Worker renders cards
  // in UTC and a reader's browser renders in their own zone, and both are the
  // wrong water clock. Force the host zone away from the station's so a label
  // formatted without an explicit timeZone cannot accidentally come out right.
  const HOST = 'Asia/Tokyo'
  let saved: string | undefined
  beforeAll(() => {
    saved = process.env.TZ
    process.env.TZ = HOST
  })
  afterAll(() => {
    process.env.TZ = saved
  })

  it('labels every time in the station zone, not the running machine zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe(DECEPTION.timezone)

    const svg = renderToStaticMarkup(
      <CurrentCurve
        station={DECEPTION}
        start={new Date('2026-08-30T00:00:00-07:00')}
        hours={24}
        now={new Date('2026-08-30T14:30:00-07:00')}
      />,
    )

    // In-chart slack labels, in America/Los_Angeles.
    for (const local of ['07:59', '14:18', '19:16']) expect(svg).toContain(`>${local}<`)
    // The same instants in Asia/Tokyo — what the broken code rendered.
    for (const host of ['23:59', '06:18', '11:16']) expect(svg).not.toContain(`>${host}<`)

    // The accessibility text, same zone — and dated, since a bare hh:mm on a
    // page a reader may open any day says nothing about which day.
    expect(svg).toContain('Maximum ebb of 1.9 knots on Sun 30 Aug 2026 at 16:47')
    // True on both rendering paths: prerendered HTML computed nothing on a device.
    expect(svg).not.toContain('this device')
  })

  it('makes no claim about the present unless the clock is real', () => {
    // The "next X, in 30m" line is a claim about now, and a prerendered page
    // makes it against a frozen build-time clock — stale the day it ships and
    // drifting after that. It renders only for a hydrated client.
    const at = { station: DECEPTION, start: new Date('2026-08-30T00:00:00-07:00'), hours: 24 }
    const now = new Date('2026-08-30T14:30:00-07:00')
    const server = renderToStaticMarkup(<CurrentCurve {...at} now={now} />)
    expect(server).not.toMatch(/in \d+[hm]/)
    expect(server).not.toContain('Next')

    const hydrated = renderToStaticMarkup(<CurrentCurve {...at} now={now} live />)
    expect(hydrated).toContain('Next')
    expect(hydrated).toMatch(/in \d+[hm]/)
    expect(hydrated).toContain('>16:47<')
  })
})

describe('CurrentCurve with fetched samples', () => {
  // A Canadian gate draws the same curve from numbers the reader's browser
  // fetched from DFO, rather than from constituents we may not re-serve.
  const DODD: ChsStation = {
    id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
    latitude: 49.135, longitude: -123.817, timezone: 'America/Vancouver',
    source: 'chs', region: 'Nanaimo',
  }
  const START = new Date('2026-09-01T00:00:00Z')
  const samples = signedSamples(
    fixture.gates['Dodd Narrows'].wcsp1,
    fixture.gates['Dodd Narrows'].wcdp1,
    fixture.gates['Dodd Narrows'].floodDirection,
  )
  const events = gateEvents(fixture.gates['Dodd Narrows']['wcp1-events'])
  const svg = renderToStaticMarkup(
    <CurrentCurve
      station={DODD} start={START} hours={24} now={new Date('2026-09-01T06:00:00Z')}
      samples={samples} events={events}
    />,
  )

  it("prints DFO's own published peak speeds on the chart", () => {
    // The number a mariner reads. DFO publishes 7.099 kn flood and 7.037 kn
    // ebb for this day; a cosine projection onto the flood axis would label
    // the ebb 6.6 and still draw a plausible-looking day.
    expect(svg).toContain('7.1 kn')
    expect(svg).toContain('7.0 kn')
  })

  it("prints DFO's own published slack times, in the station's zone", () => {
    // 01:49, 08:28, 14:38 and 20:30 UTC — Vancouver is UTC-7 on this date, and
    // the first and last fall outside the drawn frame.
    expect(svg).toContain('01:28')
    expect(svg).toContain('07:38')
  })

  it('credits DFO where a reader can see it, not only in the sr-only caption', () => {
    // The identity panel that named CHS has been replaced by the chart it
    // offered, so this is the only place left on the page that says whose
    // predictions these are. NOAA's data is public domain and the US pages
    // credit nothing here; DFO's is not.
    const visible = svg.replace(/<figcaption[^]*?<\/figcaption>/g, '')
    expect(visible).toContain('Predictions published by the Canadian Hydrographic Service')
    expect(visible).toContain('fetched from DFO by your browser')
  })

  it('says CHS published it, and claims nothing about the app', () => {
    expect(svg).toContain('published by the Canadian Hydrographic Service')
    expect(svg).not.toMatch(/harmonic constituents|offline|on-device/)
  })
})
