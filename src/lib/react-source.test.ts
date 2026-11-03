import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient, prefetchTideStation } from '@slackwater/react'
import { createLocalDataSource } from './react-source'
import { getReactStation, listReactStations } from './react-catalogue'
import { loadCatalogue } from './catalogue'
import { distanceNm } from './nearby'
import { FEET_PER_METRE } from './format'

const catalogue = { station: getReactStation, list: listReactStations }
const source = () => createLocalDataSource(catalogue, 'test:commercial:v1')
const range = { start: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z' }
afterEach(() => vi.restoreAllMocks())

describe('local React source', () => {
  it('predicts Seattle locally on chart datum in feet and meters', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const local = source()
    const feet = await local.getTimeline({ id: 'noaa/9447130', ...range, units: 'feet' })
    const meters = await local.getTimeline({ id: 'noaa/9447130', ...range, units: 'meters' })
    expect(feet.datum).toBe('MLLW')
    expect(Math.min(...feet.timeline.map((p) => p.level))).toBeCloseTo(0.81, 1)
    expect(Math.max(...feet.timeline.map((p) => p.level))).toBeCloseTo(11.36, 1)
    expect(meters.timeline[0].level * FEET_PER_METRE).toBeCloseTo(feet.timeline[0].level, 8)
    expect(feet.timeline[0].time).toBeInstanceOf(Date)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('retains a subordinate tide’s corrections and labels its high/low events', async () => {
    const local = source()
    const own = await local.getExtremes({ id: 'noaa/9448601', ...range })
    const reference = await local.getExtremes({ id: 'noaa/9447130', ...range })
    expect(own.extremes.map((e) => +e.time)).not.toEqual(reference.extremes.map((e) => +e.time))
    expect(own.extremes.every((e) => e.high !== e.low && e.label === (e.high ? 'High' : 'Low'))).toBe(true)
  })

  it('returns signed current speeds, exact zero events and published sets', async () => {
    const local = source()
    const timeline = await local.getCurrentTimeline({ id: 'noaa/PUG1701', ...range })
    const events = await local.getCurrentEvents({ id: 'noaa/PUG1701', ...range })
    expect(timeline.units).toBe('knots')
    expect(timeline.timeline.some((p) => p.speed < 0)).toBe(true)
    expect(timeline.timeline.some((p) => p.speed > 0)).toBe(true)
    expect(events.events.some((e) => e.kind === 'slack' && e.speed === 0 && e.direction === undefined)).toBe(true)
    expect(events.events.find((e) => e.kind === 'maxFlood')?.direction).toBe(timeline.station.current?.flood_direction)
    expect(events.events.find((e) => e.kind === 'maxEbb')?.speed).toBeLessThan(0)
  })

  it('refuses CHS prediction requests without making a network request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const local = source()
    const metadata = await local.getCurrentStation('chs-dodd-narrows')
    expect(metadata.predictions).toBe(false)
    await expect(local.getCurrentTimeline({ id: metadata.id, ...range })).rejects.toThrow(/browser/i)
    const port = loadCatalogue().find((s) => s.kind === 'tide' && s.source === 'chs')!
    await expect(local.getTimeline({ id: port.id, ...range })).rejects.toThrow(/browser/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects invalid or excessive prediction windows before calculating', async () => {
    await expect(source().getTimeline({ id: 'noaa/9447130', start: 'garbage' })).rejects.toThrow(/window/i)
    await expect(source().getTimeline({ id: 'noaa/9447130', start: range.end, end: range.start })).rejects.toThrow(
      /window/i,
    )
    await expect(source().getTimeline({ id: 'noaa/9447130', start: range.start, end: '2028-01-01' })).rejects.toThrow(
      /window/i,
    )
  })

  it('resolves coordinate requests through the same filtered catalogue', async () => {
    const result = await source().getTimeline({ latitude: 47.6026, longitude: -122.3393, ...range })
    expect(result.station.id).toBe('noaa/9447130')
    expect(result.distance).toBeLessThan(1)
  })

  it('preserves exact depth-bin identity and refuses unpublished bins', async () => {
    const local = source()
    await expect(local.getCurrentStation('noaa/PUG1629@999')).rejects.toThrow(/station/i)
  })
})

it('prefetches shared station pages on the server without HTTP or CHS predictions', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const client = createQueryClient()
  const local = source()
  await prefetchTideStation(client, local, 'noaa/9447130', { now: +new Date(range.start), units: 'feet' })
  const queries = client.getQueryCache().getAll()
  expect(queries.length).toBeGreaterThan(5)
  expect(queries.every((q) => q.state.status === 'success')).toBe(true)
  const timeline = queries.find((q) => q.queryKey[1] === 'timeline')!.state.data as {
    timeline: { time: Date; level: number }[]
  }
  expect(timeline.timeline[0].time).toBeInstanceOf(Date)
  expect(fetch).not.toHaveBeenCalled()
  client.clear()
})

it('rejects noncommercial metadata even when a catalogue returns it', async () => {
  const item = await getReactStation({ kind: 'tide', id: 'noaa/9447130' })
  if (item.kind !== 'tide') throw new Error('Expected tide station')
  const denied = { ...item, metadata: { ...item.metadata, license: { ...item.metadata.license, commercial_use: false } } }
  const local = createLocalDataSource({ station: async () => denied, list: async () => [denied.metadata] }, 'test:denied')
  await expect(local.getTimeline({ id: item.station.id, ...range })).rejects.toThrow(/commercial/i)
  expect(await local.getStations({})).toEqual([])
})

it('uses the nearest computable tide for coordinates beside an identity-only CHS port', async () => {
  const stations = loadCatalogue()
  const port = stations.find((s) => s.kind === 'tide' && s.source === 'chs')!
  const expected = stations.filter((s) => s.kind === 'tide' && s.source === 'bundled')
    .sort((a, b) => distanceNm(a, port) - distanceNm(b, port) || a.id.localeCompare(b.id))[0]
  const fetch = vi.spyOn(globalThis, 'fetch')
  const local = source()
  const params = { latitude: port.latitude, longitude: port.longitude, ...range }
  const timeline = await local.getTimeline(params)
  const extremes = await local.getExtremes(params)
  expect(timeline.station.id).toBe(expected.id)
  expect(extremes.station.id).toBe(expected.id)
  expect(timeline.distance).toBeCloseTo(distanceNm(expected, port) * 1.852, 8)
  expect(timeline.timeline.length).toBeGreaterThan(0)
  await expect(local.getTimeline({ id: port.id, ...range })).rejects.toThrow(/browser/i)
  expect(fetch).not.toHaveBeenCalled()
})

it('predicts an exact current reference bin using its own constituents', async () => {
  const local = source()
  const parent = await local.getCurrentStation('noaa/ACT0091')
  const id = parent.current?.offsets?.reference!
  const reference = await local.getCurrentTimeline({ id, ...range })
  const canonical = await local.getCurrentTimeline({ id: 'noaa/EPT0003', ...range })
  expect(reference.station.id).toBe('noaa/EPT0003@11')
  expect(reference.timeline.map((p) => p.speed)).not.toEqual(canonical.timeline.map((p) => p.speed))
})
