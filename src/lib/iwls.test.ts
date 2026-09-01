import { describe, expect, it } from 'vitest'
import { fetchGateCurrent, fetchPortTides, gateEvents, nearestStation, signedSamples } from './iwls'
import fixture from './__fixtures__/iwls.json' with { type: 'json' }
import portFixture from './__fixtures__/iwls-ports.json' with { type: 'json' }

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

// Recorded from api-iwls.dfo-mpo.gc.ca on 2026-09-01 for that day, so CI
// asserts against DFO's real published tide table without reaching the
// network. The station list is trimmed to the 121 records within 40 km of a
// curated port — the ten matches and the neighbours a loose tolerance would
// resolve to instead — because the live `wlp` list is 1,149 stations and 745 KB.
const VICTORIA = portFixture.ports['Victoria Harbour']
const TOFINO = portFixture.ports.Tofino

describe('fetchPortTides', () => {
  // The curated position station-metadata publishes for chs-victoria.
  const VICTORIA_POSITION = { latitude: 48.424, longitude: -123.371 }
  const START = new Date('2026-09-01T00:00:00Z')

  /** Replays the recorded day, and records every URL asked for. */
  function replay(port: typeof VICTORIA) {
    const urls: string[] = []
    const body = (url: string) => {
      if (url.includes('/stations?')) return portFixture.stations
      if (url.includes('time-series-code=wlp-hilo')) return port['wlp-hilo']
      if (url.includes('time-series-code=wlp')) return port.wlp
      throw new Error(`unexpected url ${url}`)
    }
    const fetcher: typeof fetch = async (input) => {
      const url = String(input)
      urls.push(url)
      return { ok: true, json: async () => body(url) } as Response
    }
    return { urls, fetcher }
  }

  it("quotes DFO's published high and low in FEET, not the metres it sent", async () => {
    // The whole point. DFO publishes Victoria's high for this day as 2.544 m
    // and its low as 1.065 m. Rendered as "2.5" and "1.1" beside a "ft" label
    // they would look entirely plausible and be wrong by 3.28x — which has
    // shipped on this site once already, with a test locking it in.
    const { fetcher } = replay(VICTORIA)
    const { high, low } = await fetchPortTides(VICTORIA_POSITION, START, 24, fetcher)
    expect(high.level).toBeCloseTo(8.35, 2)
    expect(low.level).toBeCloseTo(3.49, 2)
    expect(high.time.toISOString()).toBe('2026-09-01T00:49:00.000Z')
    expect(low.time.toISOString()).toBe('2026-09-01T07:29:00.000Z')
  })

  it("takes DFO's published minute, which the sampled grid does not have", () => {
    // `wlp-hilo` states the minute; the fifteen-minute grid only samples around
    // it. Victoria's high is published at 00:49 and its low at 07:29 — neither
    // is a quarter hour, so a grid maximum would print 00:45 and 07:30.
    //
    // Not asserted on the LEVEL, which is the trap here: the curve is flat
    // enough at the turn that the 00:45 sample reads 2.544 too, the same to
    // three decimals as the published high. A test on the height alone would
    // pass with the grid extremes and prove nothing. The minute is the number
    // a mariner plans a transit around, and the minute is wrong.
    const grid = VICTORIA.wlp.map((p) => p.eventDate.slice(11, 16))
    expect(grid).not.toContain('00:49')
    expect(grid).not.toContain('07:29')
    expect(VICTORIA['wlp-hilo'].map((e) => e.eventDate.slice(11, 16))).toEqual([
      '00:49', '07:29', '13:45', '18:53',
    ])
  })

  it('reads the same day right on the outer coast, where the range is twice as big', async () => {
    // Tofino, open Pacific: 3.472 m against Victoria's 2.544. A conversion that
    // happened to look plausible on one station is checked against another whose
    // numbers are nowhere near it.
    const { fetcher } = replay(TOFINO)
    const { high, low } = await fetchPortTides({ latitude: 49.154, longitude: -125.913 }, START, 24, fetcher)
    expect(high.level).toBeCloseTo(11.39, 2)
    expect(low.level).toBeCloseTo(2.44, 2)
  })

  it('asks DFO directly, and never sends resolution with the hilo series', async () => {
    // Same gotcha as `wcp1-events`: an event series answers 200 with
    // `resolution` set and quietly returns a fraction of the day's turns.
    const { urls, fetcher } = replay(VICTORIA)
    await fetchPortTides(VICTORIA_POSITION, START, 24, fetcher)
    expect(urls.every((u) => u.startsWith('https://api-iwls.dfo-mpo.gc.ca/'))).toBe(true)
    const data = urls.filter((u) => u.includes('/data?'))
    expect(data.find((u) => u.includes('wlp-hilo'))).not.toContain('resolution')
    // `wlp` is one-minute native: without this a Victoria day is 182,834 bytes
    // rather than 12,314, for a curve no reader could tell apart.
    expect(data.find((u) => u.includes('time-series-code=wlp&'))).toContain('FIFTEEN_MINUTES')
  })

  it('asks for three things, not the gates’ four — a tide has no flood axis', async () => {
    const { urls, fetcher } = replay(VICTORIA)
    await fetchPortTides(VICTORIA_POSITION, START, 24, fetcher)
    expect(urls).toHaveLength(3)
    expect(urls.some((u) => u.includes('/metadata'))).toBe(false)
  })

  it('resolves every curated port to its own IWLS station', async () => {
    // The join the whole feature rests on: the IWLS station id is
    // provider-minted, so it is never bundled and is looked up fresh from the
    // position the registry publishes. Worst real match is 0.063 km.
    for (const [lat, lon, name] of [
      [48.424, -123.371, 'Victoria Harbour'],
      [49.286, -123.1, 'Vancouver'],
      [49.337, -123.254, 'Point Atkinson'],
      [49.154, -125.913, 'Tofino'],
      [50.31, -125.223, 'Owen Bay'],
    ] as [number, number, string][]) {
      expect(nearestStation(portFixture.stations, lat, lon)?.officialName).toBe(name)
    }
  })

  it('refuses a position with no station near it rather than drawing another port', async () => {
    const { fetcher } = replay(VICTORIA)
    await expect(
      fetchPortTides({ latitude: 0, longitude: 0 }, START, 24, fetcher),
    ).rejects.toThrow(/no Canadian Hydrographic Service tide station/i)
  })
})
