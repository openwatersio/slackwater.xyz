import { describe, expect, it } from 'vitest'
import { findStations, upcomingEvents } from './discovery'
import { EVENTS } from './water-events'
import { noaaHighs, published } from './king-tides'
import { KING_TIDE_REGIONS } from './king-tide-regions'
import { instantPath, parseInstant } from '../routes/instant-url'
import type { IndexedStation } from './station-index'

const station = (name: string, kind: 'tide' | 'current', lat: number, predictions = true): IndexedStation => ({ id: name, name, kind, latitude: lat, longitude: 0, predictions, path: `/${kind}/${name}/`, attribution: 0 })
const stations = [station('Far tide', 'tide', 1.5), station('Near tide', 'tide', 1), station('Near current', 'current', 1), station('CHS', 'current', 0.5, false)]

describe('finding stations', () => {
  it('sorts each kind by distance and keeps unavailable predictions labelled', () => {
    const found = findStations(stations, { latitude: 0, longitude: 0 }, '')
    expect(found.tide.map(x => x.station.name)).toEqual(['Near tide', 'Far tide'])
    expect(found.current.map(x => x.station.name)).toEqual(['CHS', 'Near current'])
    expect(found.current[0].station.predictions).toBe(false)
  })
  it('does not call a station thousands of miles away nearby', () => {
    const distant = [station('Distant current', 'current', 30)]
    expect(findStations(distant, { latitude: 0, longitude: 0 }, '').current).toEqual([])
  })
  it('searches station names without requiring a location', () => {
    const found = findStations(stations, undefined, 'near')
    expect(found.tide[0].station.name).toBe('Near tide')
    expect(found.current[0].station.name).toBe('Near current')
    expect(findStations(stations, undefined, 'missing').tide).toEqual([])
  })
})

describe('upcoming events', () => {
  it('shows only published, unexpired events with a valid moment', () => {
    const event = { id: 'test', title: 'High tide', path: '/tides/us/wa/seattle/', time: '2027-01-25T15:16:00Z', timeZone: 'America/Los_Angeles', value: '13.1 ft above MLLW', source: 'NOAA', editor: 'Open Waters', verified: '2026-11-25T00:00:00Z', published: '2026-11-01T00:00:00Z', expires: '2027-01-25T15:16:00Z' }
    expect(upcomingEvents([event], Date.parse('2026-12-01T00:00:00Z'))).toHaveLength(1)
    expect(upcomingEvents([event], Date.parse(event.expires))).toEqual([])
    expect(upcomingEvents([{ ...event, time: 'bad' }], Date.parse('2026-12-01'))).toEqual([])
    expect(upcomingEvents([event], Date.parse('2026-10-01'))).toEqual([])
  })
})

it('publishes NOAA Seattle peaks at the linked instant with matching rounded heights', () => {
  const highs = noaaHighs('/tides/us/wa/seattle/', 2026)
  const region = KING_TIDE_REGIONS.find((item) => item.slug === 'washington')!
  const peaks = published(region, '/tides/us/wa/seattle/', 'America/Los_Angeles').flatMap((season) => season.tides)
  for (const event of EVENTS.filter((item) => item.source === 'NOAA')) {
    const high = highs.find((item) => item.time === Date.parse(event.time))
    expect(high, event.time).toBeDefined()
    expect(peaks.some((peak) => peak.time === high!.time)).toBe(true)
    expect(event.value).toBe(`${high!.level.toFixed(1)} ft above MLLW`)
    const path = instantPath(event.path, new Date(event.time), event.timeZone)
    expect(+parseInstant(path.slice(event.path.length))!).toBe(high!.time)
  }
})

it('matches the published current event to the station prediction', async () => {
  const { loadCatalogue } = await import('./catalogue')
  const { findEvents } = await import('./predict')
  const event = EVENTS.find((item) => item.source === 'Slackwater')!
  const station = loadCatalogue().find((item) => item.path === event.path)!
  if (station.source !== 'bundled') throw new Error('event station has no bundled prediction')
  const peaks = findEvents(station, new Date('2026-11-27T00:00:00Z'), 48)
  const peak = peaks.find((item) => Math.abs(+item.time - Date.parse(event.time)) < 60_000)!
  expect(peak.kind).toBe('ebb')
  expect(station.ebbDirection).toBe(232)
  expect(event.value).toBe(`${Math.abs(peak.level).toFixed(1)} knots ebb toward southwest (${station.ebbDirection}°)`)
})

it('uses a unique, nonempty URL for each event', () => {
  expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length)
  expect(EVENTS.every((event) => /^[a-z0-9-]+$/.test(event.id))).toBe(true)
})
