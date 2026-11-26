import { describe, expect, it } from 'vitest'
import { findStations, upcomingEvents } from './discovery'
import { EVENTS, eventAttribution, eventMarkdown, eventWhen } from './water-events'
import { noaaHighs, published, eventSeason } from './king-tides'
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
  it('keeps every matching station available to the finder', () => {
    const matches = Array.from({ length: 8 }, (_, i) => station(`Port Sulphur ${i}`, 'tide', i))
    expect(findStations(matches, undefined, 'port sulphur').tide).toHaveLength(8)
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
    const seattle = { ...station('Seattle', 'tide', 0), path: '/tides/us/wa/seattle/' }
    expect(findStations([seattle], undefined, 'us').tide).toEqual([])
  })
})

describe('upcoming events', () => {
  it('shows only unexpired events with a valid moment', () => {
    const event = { id: 'test', title: 'High tide', path: '/tides/us/wa/seattle/', time: '2027-01-25T15:16:00Z', timeZone: 'America/Los_Angeles', value: '13.1 ft above MLLW', source: 'NOAA', editor: 'Open Waters', verified: '2026-11-25T00:00:00Z', expires: '2027-01-25T15:16:00Z' }
    expect(upcomingEvents([event], Date.parse('2026-12-01T00:00:00Z'))).toHaveLength(1)
    expect(upcomingEvents([event], Date.parse(event.expires))).toEqual([])
    expect(upcomingEvents([{ ...event, time: 'bad' }], Date.parse('2026-12-01'))).toEqual([])
  })
})

it('checks each NOAA event against its station and any saved season', () => {
  for (const event of EVENTS.filter((item) => item.source === 'NOAA')) {
    const region = KING_TIDE_REGIONS.find((item) => item.stations.some(([path]) => path === event.path))
    expect(region, event.path).toBeDefined()
    const season = eventSeason(region!, new Date(event.time), event.timeZone)
    if (season === undefined) {
      expect(Date.parse(event.time)).toBeLessThan(Date.now())
      continue
    }
    const seasons = [season]
    const highs = seasons.flatMap((season) => noaaHighs(event.path, season))
    const high = highs.find((item) => item.time === Date.parse(event.time))
    expect(high, event.time).toBeDefined()
    const peaks = published({ ...region!, seasons }, event.path, event.timeZone).flatMap((season) => season.tides)
    expect(peaks.some((peak) => peak.time === high!.time)).toBe(true)
    expect(event.value).toBe(`${high!.level.toFixed(1)} ft above MLLW`)
    if (event.highlight) {
      expect(event.highlight.peakFeet).toBe(high!.level)
      const datumByStation: Record<string, { feet: number; url: string }> = { '/tides/us/wa/seattle/': { feet: 11.36, url: 'https://tidesandcurrents.noaa.gov/benchmarks/9447130.html' } }
      expect(event.highlight.averageHigherHighFeet).toBe(datumByStation[event.path]?.feet)
      expect(event.highlight.datumUrl).toBe(datumByStation[event.path]?.url)
    }
    const path = instantPath(event.path, new Date(event.time), event.timeZone)
    expect(+parseInstant(path.slice(event.path.length))!).toBe(high!.time)
  }
})

it('matches each upcoming current event to its station prediction', async () => {
  const { loadCatalogue } = await import('./catalogue')
  const { findEvents } = await import('./predict')
  for (const event of EVENTS.filter((item) => item.source === 'Slackwater' && Date.parse(item.time) > Date.now())) {
    const station = loadCatalogue().find((item) => item.path === event.path)!
    if (station.source !== 'bundled') throw new Error('event station has no bundled prediction')
    const peaks = findEvents(station, new Date(Date.parse(event.time) - 6 * 3600_000), 12)
    const peak = peaks.find((item) => Math.abs(+item.time - Date.parse(event.time)) < 60_000)!
    expect(peak).toBeDefined()
    expect(event.value).toContain(`${Math.abs(peak.level).toFixed(1)} knots ${peak.kind}`)
    const direction = peak.kind === 'ebb' ? station.ebbDirection : station.floodDirection
    expect(event.value).toContain(`${direction}°`)
  }
})

it('uses a unique, nonempty URL for each event', () => {
  expect(new Set(EVENTS.map((event) => event.id)).size).toBe(EVENTS.length)
  expect(EVENTS.every((event) => /^[a-z0-9-]+$/.test(event.id))).toBe(true)
})

it('describes each event in its local time and Markdown twin', () => {
  for (const event of EVENTS) {
    const md = eventMarkdown(event)
    expect(md).toContain(event.value)
    expect(md).toContain(event.source)
    expect(md).toContain(eventWhen(event))
    expect(md).toContain('Predictions are not observations')
    expect(md).toContain(instantPath(event.path, new Date(event.time), event.timeZone))
    expect(md).toContain(eventAttribution(event))
  }
})

it('identifies the exact current station in the event title', () => {
  expect(EVENTS.find((event) => event.source === 'Slackwater')!.title).toContain('Yokeko Point')
})

it('credits NOAA predictions to NOAA and current stations to their catalogue notice', async () => {
  const { loadCatalogue, stationAttribution } = await import('./catalogue')
  for (const event of EVENTS) {
    if (event.source === 'NOAA') expect(eventAttribution(event)).toContain('NOAA Center for Operational Oceanographic Products and Services')
    else {
      const station = loadCatalogue().find((s) => s.path === event.path)!
      expect(eventAttribution(event)).toBe(stationAttribution(station.id))
    }
  }
})

it('assigns a January peak to the preceding winter, never the next season', () => {
  const region = KING_TIDE_REGIONS.find((item) => item.slug === 'washington')!
  const event = new Date('2027-01-25T15:16:00Z')
  expect(eventSeason({ ...region, seasons: [2026, 2027] }, event, 'America/Los_Angeles')).toBe(2026)
  expect(eventSeason({ ...region, seasons: [2027] }, event, 'America/Los_Angeles')).toBeUndefined()
})

it('formats event times consistently for server and browser', () => {
  expect(eventWhen(EVENTS[0])).toBe('Friday, November 27, 2026 at 7:39 AM PST')
})

it('accepts each curated event at its verification time', () => {
  for (const event of EVENTS) expect(upcomingEvents([event], Date.parse(event.verified)), event.id).toEqual([event])
})

it('uses the station’s own time zone for every curated event', async () => {
  const { loadCatalogue } = await import('./catalogue')
  const catalogue = loadCatalogue()
  for (const event of EVENTS) expect(event.timeZone).toBe(catalogue.find((station) => station.path === event.path)?.timezone)
})
