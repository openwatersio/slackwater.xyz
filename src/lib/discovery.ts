import { distanceNm, type Positioned } from './nearby'
import type { IndexedStation } from './station-index'

export interface Event {
  id: string
  title: string
  path: string
  time: string
  timeZone: string
  value: string
  source: string
  expires: string
  verified: string
  editor: string
  highlight?: { peakFeet: number; averageHigherHighFeet: number; datumUrl: string }
}

export function upcomingEvents(events: Event[], now: number): Event[] {
  return events.filter((event) => {
    const time = Date.parse(event.time), end = Date.parse(event.expires)
    return event.id && event.title && event.editor && Number.isFinite(Date.parse(event.verified)) && (event.path.startsWith('/tides/') || event.path.startsWith('/currents/')) && event.source && event.value &&
      Number.isFinite(time) && Number.isFinite(end) && now < end && time >= now && end <= time
  }).sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
}

export function findStations(stations: IndexedStation[], location: Positioned | undefined, query: string) {
  const term = query.trim().toLocaleLowerCase()
  const results = stations.filter((s) => !term || s.name.toLocaleLowerCase().includes(term) || (s.path.split('/').filter(Boolean).at(-1)?.toLocaleLowerCase().includes(term) ?? false))
    .map((station) => ({ station, distance: location ? distanceNm(location, station) : undefined }))
    .filter((result) => !location || result.distance! <= 100)
  if (location) results.sort((a, b) => a.distance! - b.distance!)
  else results.sort((a, b) => a.station.name.localeCompare(b.station.name))
  return { tide: results.filter((r) => r.station.kind === 'tide'), current: results.filter((r) => r.station.kind === 'current') }
}
