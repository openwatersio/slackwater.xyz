import { describe, expect, it } from 'vitest'
import { fetchRefinement, levelAt, refinementDay } from './refine'
import portFixture from './__fixtures__/iwls-ports.json' with { type: 'json' }
import type { BundledStation } from './station'

const VICTORIA: BundledStation = {
  id: 'ticon/victoria_bc-543a-can-uhslc_rq', kind: 'tide', slug: 'victoria', name: 'Victoria',
  path: '/tides/ca/bc/victoria/',
  latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
  source: 'bundled', chartDatum: 'LAT',
  constituents: [{ name: 'M2', amplitude: 2.5, phase: 0 }],
  chs: { id: 'chs-victoria' },
}

describe('refinementDay', () => {
  it("is the station-local day the reader is in, so it lands on the day pager's today", () => {
    const { start, hours } = refinementDay(VICTORIA, new Date('2026-09-01T12:00:00Z'))
    expect(start.toISOString()).toBe('2026-09-01T07:00:00.000Z')
    expect(hours).toBe(24)
  })

  it('runs 25 hours on the day the clocks go back', () => {
    // Los Angeles rather than Vancouver: British Columbia keeps daylight time
    // year-round in the zone data this runs on, so its day never stretches.
    const seattle = { ...VICTORIA, timezone: 'America/Los_Angeles' }
    const { start, hours } = refinementDay(seattle, new Date('2026-11-01T20:00:00Z'))
    expect(start.toISOString()).toBe('2026-11-01T07:00:00.000Z')
    expect(hours).toBe(25)
  })
})

describe('fetchRefinement', () => {
  const port = portFixture.ports['Victoria Harbour']
  const urls: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    urls.push(url)
    const body = url.includes('/stations?')
      ? portFixture.stations
      : url.includes('wlp-hilo')
        ? port['wlp-hilo']
        : port.wlp
    return { ok: true, json: async () => body } as Response
  }

  it("asks DFO, from the reader's browser, for the station-local day", async () => {
    const refined = await fetchRefinement(VICTORIA, new Date('2026-09-01T12:00:00Z'), fetcher)
    expect(refined.kind).toBe('tide')
    expect(refined.start.toISOString()).toBe('2026-09-01T07:00:00.000Z')
    expect(refined.hours).toBe(24)
    expect(urls.every((u) => u.startsWith('https://api-iwls.dfo-mpo.gc.ca/'))).toBe(true)
    expect(urls.filter((u) => u.includes('/data?')).every((u) => u.includes('from=2026-09-01T07:00:00.000Z'))).toBe(true)
    expect(refined.kind === 'tide' && refined.turns).toHaveLength(4)
  })

  it('refuses a station with no CHS identity, rather than resolving one by position', async () => {
    const { chs: _, ...plain } = VICTORIA
    await expect(fetchRefinement(plain, new Date('2026-09-01T12:00:00Z'), fetcher)).rejects.toThrow(/CHS/)
  })
})

describe('levelAt', () => {
  const samples = [
    { time: new Date('2026-09-01T00:00:00Z'), level: 2 },
    { time: new Date('2026-09-01T00:15:00Z'), level: 4 },
  ]

  it('interpolates between the samples DFO sent', () => {
    expect(levelAt(samples, new Date('2026-09-01T00:05:00Z'))).toBeCloseTo(2 + 2 / 3, 6)
  })

  it('says nothing outside them, rather than extrapolating', () => {
    expect(levelAt(samples, new Date('2026-08-31T23:59:00Z'))).toBeUndefined()
    expect(levelAt(samples, new Date('2026-09-01T00:16:00Z'))).toBeUndefined()
  })
})
