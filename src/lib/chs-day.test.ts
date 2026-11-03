import { afterEach, expect, it, vi } from 'vitest'
import { fetchBrowserChsDay, hasChsDay } from './chs-day'
import { getReactStation } from './react-catalogue'
import fixture from './__fixtures__/iwls.json' with { type: 'json' }
import ports from './__fixtures__/iwls-ports.json' with { type: 'json' }

afterEach(() => vi.unstubAllGlobals())

it('never contacts DFO on the server, even when called directly', async () => {
  const { station } = await getReactStation({ kind: 'current', id: 'chs-dodd-narrows' })
  const fetcher = vi.fn<typeof fetch>()
  await expect(fetchBrowserChsDay(station, new Date(), fetcher)).rejects.toThrow(/browser/i)
  expect(fetcher).not.toHaveBeenCalled()
})

it('keeps a derived CHS gate identity-only', async () => {
  const { station } = await getReactStation({ kind: 'current', id: 'chs-malibu-rapids' })
  expect(hasChsDay(station)).toBe(false)
  vi.stubGlobal('window', {})
  await expect(fetchBrowserChsDay(station, new Date())).rejects.toThrow(/derived|no CHS/i)
})

it('uses the existing direct-browser fetcher for exactly one local day and DFO’s published events', async () => {
  vi.stubGlobal('window', {})
  const { station } = await getReactStation({ kind: 'current', id: 'chs-dodd-narrows' })
  const urls: string[] = []
  const gate = fixture.gates['Dodd Narrows']
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    urls.push(url)
    const body = url.includes('/stations?')
      ? fixture.stations
      : url.endsWith('/metadata')
        ? { floodDirection: gate.floodDirection }
        : url.includes('wcp1-events')
          ? gate['wcp1-events']
          : url.includes('wcdp1')
            ? gate.wcdp1
            : gate.wcsp1
    return Response.json(body)
  }
  const day = await fetchBrowserChsDay({ ...station, timezone: 'UTC' }, new Date('2026-09-01T12:00:00Z'), fetcher)
  expect(day.kind).toBe('current')
  expect(day.hours).toBe(24)
  expect(urls).toHaveLength(5)
  expect(urls.every((u) => u.startsWith('https://api-iwls.dfo-mpo.gc.ca/'))).toBe(true)
  expect(
    urls
      .filter((u) => u.includes('/data?'))
      .every((u) => new URL(u).searchParams.get('to') === '2026-09-02T00:00:00.000Z'),
  ).toBe(true)
  if (day.kind !== 'current') throw new Error('Expected current data')
  expect(day.events.filter((e) => e.kind === 'slack').map((e) => e.time.toISOString().slice(11, 16))).toEqual([
    '01:49',
    '08:28',
    '14:38',
    '20:30',
  ])
})

it('keeps a merged Canadian port’s CHS heights in feet on chart datum', async () => {
  vi.stubGlobal('window', {})
  const { station } = await getReactStation({ kind: 'tide', id: 'ticon/victoria_bc-543a-can-uhslc_rq' })
  const port = ports.ports['Victoria Harbour']
  const urls: string[] = []
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    urls.push(url)
    return Response.json(
      url.includes('/stations?') ? ports.stations : url.includes('wlp-hilo') ? port['wlp-hilo'] : port.wlp,
    )
  }
  const day = await fetchBrowserChsDay(station, new Date('2026-09-01T12:00:00Z'), fetcher)
  expect(day.kind).toBe('tide')
  expect(urls).toHaveLength(3)
  if (day.kind !== 'tide') throw new Error('Expected tide data')
  expect(day.high.level).toBeCloseTo(8.34646, 4)
  expect(day.turns.length).toBeGreaterThan(0)
})

it('reports an unavailable CHS current day when DFO returns empty series', async () => {
  vi.stubGlobal('window', {})
  const { station } = await getReactStation({ kind: 'current', id: 'chs-dodd-narrows' })
  const fetcher: typeof fetch = async (input) => Response.json(
    String(input).includes('/stations?') ? fixture.stations :
    String(input).endsWith('/metadata') ? { floodDirection: fixture.gates['Dodd Narrows'].floodDirection } : [])
  await expect(fetchBrowserChsDay(station, new Date('2026-09-01T12:00:00Z'), fetcher))
    .rejects.toThrow(/unavailable/i)
})
