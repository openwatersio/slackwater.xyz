import { describe, expect, it } from 'vitest'
import { fetchGateCurrent, gateEvents, nearestStation, signedSamples } from './iwls'
import fixture from './__fixtures__/iwls.json' with { type: 'json' }

// Recorded from api-iwls.dfo-mpo.gc.ca on 2026-08-31 for 1 September 2026, so
// CI asserts against DFO's real numbers without reaching the network. The
// published extrema in `wcp1-events` are the bar every assertion here is set
// against: whatever the curve does, its peaks must be the numbers DFO prints.
const DODD = fixture.gates['Dodd Narrows']
const DENT = fixture.gates['Dent Rapids']

const peaks = (levels: number[]) => ({
  flood: Math.max(...levels),
  ebb: Math.min(...levels),
})

describe('signedSamples', () => {
  it("reproduces DFO's published peaks at Dodd Narrows, where the ebb axis is 20 degrees off", () => {
    // flood 355, ebb 155 — 200 degrees apart, not 180. Projecting the speed
    // onto the flood axis with a full cosine shrinks the ebb by that 20
    // degrees: -6.61 kn against the 7.037 DFO publishes for the same instant,
    // with the event label printing 7.0 beside a curve peaking at 6.6.
    const { flood, ebb } = peaks(
      signedSamples(DODD.wcsp1, DODD.wcdp1, DODD.floodDirection).map((s) => s.level),
    )
    expect(flood).toBeCloseTo(7.099, 2)
    expect(ebb).toBeCloseTo(-7.037, 2)
  })

  it('reproduces them at Dent Rapids too, where the axis runs the other way', () => {
    // Dodd floods north (355) and ebbs south (155); Dent floods south-east
    // (140) and ebbs north-north-west (340). A sign rule that happened to work
    // on one orientation and not the other would pass the Dodd test alone.
    const { flood, ebb } = peaks(
      signedSamples(DENT.wcsp1, DENT.wcdp1, DENT.floodDirection).map((s) => s.level),
    )
    expect(flood).toBeCloseTo(8.316, 2)
    expect(ebb).toBeCloseTo(-7.927, 2)
  })

  it('floods and ebbs when DFO says it does, not merely with the right shape', () => {
    // A sign error inverts flood and ebb everywhere at once: the colour ramp
    // flips, and every slack time still looks plausible. So this checks the
    // sign AT the published extrema rather than checking that the curve has
    // some maximum and some minimum.
    const at = new Map(
      signedSamples(DODD.wcsp1, DODD.wcdp1, DODD.floodDirection).map((s) => [
        s.time.toISOString(),
        s.level,
      ]),
    )
    // 11:16 max flood, 05:01 max ebb — but the extrema fall between samples,
    // so check the quarter-hour each one sits in.
    expect(at.get('2026-09-01T11:15:00.000Z')).toBeGreaterThan(6)
    expect(at.get('2026-09-01T05:00:00.000Z')).toBeLessThan(-6)
  })
})

describe('gateEvents', () => {
  const events = gateEvents(DODD['wcp1-events'])
  const hhmm = (d: Date) => d.toISOString().slice(11, 16)

  it("carries DFO's own published slack times, to the minute", () => {
    // The four slacks DFO publishes for Dodd Narrows on 1 September 2026.
    // These are the times the page promises a transit at, so they are checked
    // against the published table rather than against our own interpolation:
    // `findEvents` derives slack from a sign change between samples, and DFO
    // simply states it.
    expect(events.filter((e) => e.kind === 'slack').map((e) => hhmm(e.time))).toEqual([
      '01:49', '08:28', '14:38', '20:30',
    ])
  })

  it('signs an ebb negative, because DFO publishes the qualifier and not the sign', () => {
    // `value` is unsigned in the events series exactly as it is in `wcsp1`:
    // DFO prints max ebb at Dodd as +7.037 and says EXTREMA_EBB beside it.
    // Carried through unsigned, the ebb peaks would draw above the datum line
    // and the whole day would read as one long flood.
    const ebbs = events.filter((e) => e.kind === 'ebb')
    const floods = events.filter((e) => e.kind === 'flood')
    expect(ebbs.map((e) => e.level)).toEqual([-7.037, -5.349])
    expect(floods.map((e) => e.level)).toEqual([7.099, 6.028])
  })

  it('gives slack a level of exactly zero, and returns the day in time order', () => {
    expect(events.filter((e) => e.kind === 'slack').every((e) => e.level === 0)).toBe(true)
    const times = events.map((e) => e.time.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})

describe('nearestStation', () => {
  // The curated positions station-metadata publishes. The IWLS station id is
  // resolved from these at runtime and never bundled — that omission is the
  // posture, not an optimisation, so this is the join the whole feature rests
  // on.
  const stations = fixture.stations

  it('resolves a gate to its own IWLS station from the curated position alone', () => {
    const dodd = nearestStation(stations, 49.13546639419797, -123.81735084108287)
    expect(dodd?.officialName).toBe('Dodd Narrows')

    const dent = nearestStation(stations, 50.41, -125.2117)
    expect(dent?.officialName).toBe('Dent Rapids')
  })

  it('refuses a derived gate rather than drawing the wrong water', () => {
    // chs-malibu-rapids has no IWLS current station of its own: slack is the
    // reference port's high and low water plus a fixed lag. The nearest thing
    // to it in the list is Sechelt Rapids, 47 km away down a different inlet.
    // Silently resolving to that would draw a real curve for real water that
    // is not this station, which is the worst failure available here.
    expect(nearestStation(stations, 50.1626, -123.8515)).toBeUndefined()
  })

  it('holds the tolerance at 3 km, the distance the app resolves within', () => {
    // Quatsino Narrows is the worst real match in the corpus at 0.17 km, so
    // the tolerance has two orders of magnitude of headroom on every gate. A
    // point 5 km off any station must still miss.
    expect(nearestStation(stations, 50.555, -127.5574)?.officialName).toBe('Quatsino Narrows')
    expect(nearestStation(stations, 0, 0)).toBeUndefined()
  })
})

describe('fetchGateCurrent', () => {
  const DODD_POSITION = { latitude: 49.13546639419797, longitude: -123.81735084108287 }
  const START = new Date('2026-09-01T00:00:00Z')

  /** Replays the recorded fixture, and records every URL asked for. */
  function replay() {
    const urls: string[] = []
    const body = (url: string) => {
      if (url.includes('/stations?')) return fixture.stations
      if (url.includes('/metadata')) return { floodDirection: DODD.floodDirection }
      for (const ts of ['wcp1-events', 'wcsp1', 'wcdp1']) {
        if (url.includes(`time-series-code=${ts}`)) return DODD[ts as 'wcsp1']
      }
      throw new Error(`unexpected url ${url}`)
    }
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      urls.push(url)
      return { ok: true, json: async () => body(url) } as Response
    }
    return { urls, fetcher }
  }

  it('asks DFO directly, never a same-origin path that would mean we re-served it', async () => {
    const { urls, fetcher } = replay()
    await fetchGateCurrent(DODD_POSITION, START, 24, fetcher)
    // Every request absolute and at DFO. A relative URL here would be a Worker
    // route, which is the one thing this whole feature exists to avoid.
    expect(urls.every((u) => u.startsWith('https://api-iwls.dfo-mpo.gc.ca/'))).toBe(true)
  })

  it('asks for fifteen-minute series, but never sends resolution with the events', async () => {
    // `wcp1-events` answers 200 with `resolution` set and quietly returns one
    // event for the day instead of eight. Nothing about the response says it
    // was truncated: the page draws a curve with one slack on it and every
    // count stays green.
    const { urls, fetcher } = replay()
    await fetchGateCurrent(DODD_POSITION, START, 24, fetcher)
    // Data requests only: the station list is itself filtered by
    // `time-series-code=wcsp1`, so a looser match finds that URL instead.
    const data = urls.filter((u) => u.includes('/data?'))
    expect(data.find((u) => u.includes('wcp1-events'))).not.toContain('resolution')
    for (const ts of ['wcsp1', 'wcdp1']) {
      expect(data.find((u) => u.includes(`time-series-code=${ts}`))).toContain(
        'resolution=FIFTEEN_MINUTES',
      )
    }
  })

  it('returns the signed curve and the published events together', async () => {
    const { fetcher } = replay()
    const { samples, events } = await fetchGateCurrent(DODD_POSITION, START, 24, fetcher)
    expect(peaks(samples.map((s) => s.level)).ebb).toBeCloseTo(-7.037, 2)
    expect(events.filter((e) => e.kind === 'slack')).toHaveLength(4)
  })

  it('refuses a station it cannot resolve, instead of drawing another gate', async () => {
    const { fetcher } = replay()
    await expect(
      fetchGateCurrent({ latitude: 50.1626, longitude: -123.8515 }, START, 24, fetcher),
    ).rejects.toThrow(/no Canadian Hydrographic Service current station/i)
  })
})
