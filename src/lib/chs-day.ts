import { dayStart } from './format'
import { fetchGateCurrent, fetchPortTides } from './iwls'
import { fetchRefinement, type Refined } from './refine'
import type { Station } from './station'

export function hasChsDay(station: Station): boolean {
  return station.source === 'chs' ? !station.derived : Boolean(station.chs)
}

/** Keep the one published day out of server rendering and multi-week standing calculations. */
export async function fetchBrowserChsDay(station: Station, now: Date, fetcher: typeof fetch = fetch): Promise<Refined> {
  if (typeof window === 'undefined') throw new Error('CHS predictions are browser-only.')
  if (!hasChsDay(station)) throw new Error('This derived station has no CHS day to fetch.')
  if (station.source === 'bundled') return fetchRefinement(station, now, fetcher)
  const start = dayStart(now, station.timezone)
  const end = dayStart(now, station.timezone, 1)
  const hours = (+end - +start) / 3600_000
  return station.kind === 'tide'
    ? { kind: 'tide', start, hours, ...(await fetchPortTides(station, start, hours, fetcher)) }
    : { kind: 'current', start, hours, ...(await fetchGateCurrent(station, start, hours, fetcher)) }
}
