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
 * The station-local day `now` falls in — exactly the day the page's day pager
 * calls Today, so the layer lands on the frame the reader is looking at
 * rather than a 24-hour window that straddles two of them.
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

/**
 * The level at one instant, interpolated between DFO's fifteen-minute
 * samples, or undefined outside them: past the end of the day DFO sent there
 * is nothing to read, and extrapolating would invent a number.
 */
export function levelAt(samples: Sample[], at: Date): number | undefined {
  const t = at.getTime()
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (t < a.time.getTime() || t > b.time.getTime()) continue
    const span = b.time.getTime() - a.time.getTime()
    return span ? a.level + ((b.level - a.level) * (t - a.time.getTime())) / span : a.level
  }
  return undefined
}
