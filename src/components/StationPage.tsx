import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { dayLabel } from '#/lib/format'
import type { Station } from '#/lib/station'

interface Props {
  station: Station
  /** The moment the page is centred on: the reader's clock, or a shared instant. */
  now: Date
  /** True only on a hydrated client — see `useLiveNow`. */
  live?: boolean
}

/**
 * One station, one moment — the body shared by all four station routes.
 *
 * The canonical and instant routes differ in their loader, canonical link and
 * card, not in what they draw, so the page itself lives here rather than in
 * four near-identical copies that can drift apart.
 */
export function StationPage({ station, now, live = false }: Props) {
  const start = new Date(now.getTime() - 6 * 3600_000)
  // The date, always, in the station's own zone. The chart speaks in bare
  // `hh:mm`, and a shared link can point at any day — without this a receiver
  // cannot tell which day's water they are looking at. Joined with the region
  // rather than sitting in its own element so that a station with no region
  // (every current station: the NOAA bundle carries no region field) renders
  // one line instead of one line and an empty <p>.
  const subtitle = [station.region, dayLabel(now, station.timezone)].filter(Boolean).join(' · ')
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{subtitle}</p>
      {station.kind === 'tide' ? (
        <TideCurve station={station} start={start} hours={24} now={now} />
      ) : (
        <CurrentCurve station={station} start={start} hours={24} now={now} live={live} />
      )}
    </main>
  )
}
