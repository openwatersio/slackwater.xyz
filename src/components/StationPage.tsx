import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { dayLabel } from '#/lib/format'
import { TESTFLIGHT } from '#/lib/links'
import type { StationRow } from '#/lib/catalogue-server'
import type { Station } from '#/lib/station'

interface Props {
  station: Station
  /** The moment the page is centred on: the reader's clock, or a shared instant. */
  now: Date
  /** True only on a hydrated client — see `useLiveNow`. */
  live?: boolean
  /** Nearest stations of the same kind. Empty is fine — the section hides. */
  nearby?: StationRow[]
}

/**
 * One station, one moment — the body shared by all four station routes.
 *
 * The canonical and instant routes differ in their loader, canonical link and
 * card, not in what they draw, so the page itself lives here rather than in
 * four near-identical copies that can drift apart.
 */
export function StationPage({ station, now, live = false, nearby = [] }: Props) {
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
      <Nearby station={station} rows={nearby} />
      <Cta />
    </main>
  )
}

/**
 * Neighbouring stations, which are the question a reader actually has next:
 * the water at the next headland, not the same water again. Also the only
 * thing linking station pages to each other — without it all 3,607 are
 * reachable from the sitemap and nothing else.
 */
function Nearby({ station, rows }: { station: Station; rows: StationRow[] }) {
  if (!rows.length) return null
  const base = station.kind === 'tide' ? '/tides/' : '/currents/'
  const all = station.kind === 'tide' ? '/stations/tides/' : '/stations/currents/'
  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium uppercase tracking-wider text-sw-leaf">Nearby</h2>
      <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.slug}>
            <a href={`${base}${r.slug}/`} className="text-sw-paper/90 hover:text-sw-leaf">
              {r.name}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <a href={all} className="text-sw-steel underline underline-offset-4 hover:text-sw-paper">
          All {station.kind === 'tide' ? 'tide' : 'current'} stations
        </a>
      </p>
    </section>
  )
}

/**
 * The reason these pages exist: a shared link reaches someone without the app,
 * so every station page has to offer the app. Kept honest against what ships —
 * tides are worldwide, currents are not (see the corpus split in the catalogue).
 *
 * The home link is not decoration: without it all 3,607 station pages are
 * orphans with no internal link back into the site.
 */
function Cta() {
  return (
    <section className="mt-14 border-t border-sw-steel/15 pt-8">
      <p className="text-sw-steel">
        Slackwater predicts tides and currents offline, on your phone — tides worldwide,
        currents across the US and Canada.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {TESTFLIGHT ? (
          <a
            href={TESTFLIGHT}
            className="rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
          >
            Get the beta on TestFlight
          </a>
        ) : (
          <span className="rounded-md border border-sw-leaf/30 px-5 py-3 font-medium text-sw-steel">
            iPhone beta — opening soon
          </span>
        )}
        <a
          href="/"
          className="whitespace-nowrap text-sw-steel underline underline-offset-4 transition hover:text-sw-paper"
        >
          Slackwater
        </a>
      </div>
    </section>
  )
}
