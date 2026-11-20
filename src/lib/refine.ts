/**
 * CHS's own published day, drawn over a computed station's curve.
 *
 * CLIENT CODE, like `iwls.ts`, which does the fetching; this only decides
 * which day to ask for and reads the answer back.
 *
 * A route the database merged — a curated CHS record and a provider row with
 * harmonic constituents — prerenders as a computed page, because a curve on
 * arrival is better than none. CHS's prediction is the refined data: once the
 * page is in the reader's browser, the browser asks DFO for today, and the
 * chart and today's rows in the week table switch to it. The same posture as a CHS-only page: the request goes
 * straight from the browser to IWLS, nothing is proxied, prerendered or
 * stored by us.
 */
import { dayStart } from './format'
import { fetchGateCurrent, fetchPortTides } from './iwls'
import type { Sample, StationEvent, TideExtreme } from './predict'
import type { BundledStation } from './station'

/** One day of CHS predictions, and the window it was fetched for. */
export type Refined = { start: Date; hours: number } & (
  | { kind: 'tide'; samples: Sample[]; high: Sample; low: Sample; turns: TideExtreme[] }
  | { kind: 'current'; samples: Sample[]; events: StationEvent[] }
)

/**
 * The station-local day `now` falls in — the day the strip labels Today, and
 * the day the 7-day table's first rows belong to — so the layer replaces one
 * whole day rather than a 24-hour window that straddles two of them.
 */
export function refinementDay(station: BundledStation, now: Date): { start: Date; hours: number } {
  const start = dayStart(now, station.timezone)
  const end = dayStart(now, station.timezone, 1)
  return { start, hours: (end.getTime() - start.getTime()) / 3600_000 }
}

/**
 * Ask DFO for the station's CHS day, from the reader's browser.
 *
 * Only for a station carrying a CHS identity. Without one there is no
 * curated record vouching that a CHS station measures this water, and
 * resolving the nearest one by position would put another port's numbers
 * under this name.
 */
export async function fetchRefinement(
  station: BundledStation,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<Refined> {
  if (!station.chs) throw new Error(`refine: ${station.id} carries no CHS identity`)
  const { start, hours } = refinementDay(station, now)
  return station.kind === 'tide'
    ? { kind: 'tide', start, hours, ...(await fetchPortTides(station, start, hours, fetcher)) }
    : { kind: 'current', start, hours, ...(await fetchGateCurrent(station, start, hours, fetcher)) }
}
