import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CurrentCurve } from './CurrentCurve'
import type { Station } from '#/lib/station'

const DECEPTION: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
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
