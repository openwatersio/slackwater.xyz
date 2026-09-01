import { useState } from 'react'
import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { dayLabel } from '#/lib/format'
import { fetchGateCurrent } from '#/lib/iwls'
import { TESTFLIGHT } from '#/lib/links'
import type { StationRow } from '#/lib/catalogue-server'
import type { Sample, StationEvent } from '#/lib/predict'
import type { ChsStation, Station } from '#/lib/station'

/** One gate's day, once the reader has asked DFO for it. */
interface Curve {
  samples: Sample[]
  events: StationEvent[]
}

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
  // Held here rather than in `ChsGate` because the subtitle is here: a page
  // that has just gained a chart also gains the date that chart needs.
  const [curve, setCurve] = useState<Curve | undefined>()
  // The date, always, in the station's own zone — but only where there is a
  // chart to date. The chart speaks in bare `hh:mm`, and a shared link can
  // point at any day — without a date a receiver cannot tell which day's
  // water they are looking at. A CHS page draws no chart, so there is
  // nothing for a date to disambiguate: on a prerender `now` is the fixed
  // build clock, and printing it would read as the freshness of information
  // that is not there. Joined with the region rather than sitting in its own
  // element so that a station with no region (most current stations: the
  // NOAA bundle carries no region field) renders one line instead of one
  // line and an empty <p>.
  // ... and a Canadian page once it draws one, for exactly the same reason: a
  // shared link can point at any day, and a bare `hh:mm` cannot say which.
  const date = station.source === 'bundled' || curve ? dayLabel(now, station.timezone) : undefined
  const subtitle = [station.region, date].filter(Boolean).join(' · ')
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{subtitle}</p>
      {station.source === 'chs' ? (
        curve ? (
          <CurrentCurve
            station={station} start={start} hours={24} now={now} live={live}
            samples={curve.samples} events={curve.events}
          />
        ) : (
          <ChsGate station={station} start={start} hours={24} onCurve={setCurve} />
        )
      ) : station.kind === 'tide' ? (
        <TideCurve station={station} start={start} hours={24} now={now} />
      ) : (
        <CurrentCurve station={station} start={start} hours={24} now={now} live={live} />
      )}
      <Nearby station={station} rows={nearby} />
      <Cta station={station} />
    </main>
  )
}

/**
 * A Canadian station, named but not predicted — and an offer to go and get the
 * prediction from DFO.
 *
 * CHS predictions are fetched by each user under DFO's own terms and never
 * re-served, so this page ships identity and nothing else. The curve arrives
 * only on a deliberate action, from the reader's own browser, straight to
 * `api-iwls.dfo-mpo.gc.ca`. It is never prerendered, never proxied through the
 * Worker, and never stored by us; the moment we fetch it, we are re-serving.
 *
 * The panel's own wording deliberately says nothing about HOW THE APP answers
 * here. Fourteen of these gates are predicted on device from a fitted model;
 * nine are never fitted and are fetched from CHS on demand. Nothing in the
 * published registry says which is which, so any sentence naming a mechanism
 * is false for one group or the other (#44). That constraint is about the app
 * and does not reach the curve, which is CHS's own published prediction for
 * every gate without exception — so the stronger claim lives in the curve's
 * caption, and must not drift up into this panel.
 */
function ChsGate({
  station,
  start,
  hours,
  onCurve,
}: {
  station: ChsStation
  start: Date
  hours: number
  onCurve: (curve: Curve) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function show() {
    setBusy(true)
    setError(undefined)
    try {
      onCurve(await fetchGateCurrent(station, start, hours))
    } catch (e) {
      // The thrown message is the sentence the reader should see: past the
      // resolution tolerance it says there is no station here, and it must not
      // be flattened into a generic failure that invites a pointless retry.
      setError(e instanceof Error ? e.message : 'The predictions could not be loaded.')
      setBusy(false)
    }
  }

  return (
    <section className="mt-10 rounded-lg border border-sw-steel/20 p-6">
      <p className="text-sw-foam">
        Predictions for {station.name} are based on Canadian Hydrographic Service data,
        fetched under DFO&rsquo;s own terms. Slackwater covers this water in the app.
      </p>
      {/* A derived gate has no CHS current station to ask about — its slack is
          a reference port's high and low water plus a fixed lag — so it gets no
          button rather than one that could only fail. */}
      {!station.derived && (
        <div className="mt-5">
          <button
            type="button"
            onClick={show}
            disabled={busy}
            className="rounded-md border border-sw-leaf/40 px-5 py-3 font-medium text-sw-foam transition hover:border-sw-leaf hover:text-sw-leaf disabled:opacity-60"
          >
            {busy ? 'Asking the CHS\u2026' : "Show today's currents"}
          </button>
          {/* Said before the click, while the reader can still decline: this is
              their browser contacting a third party, and the privacy policy
              makes the same promise in the same words. */}
          <p className="mt-3 text-sm text-sw-steel">
            Your browser fetches these directly from the Canadian Hydrographic Service.
            Nothing is sent to us.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-sw-foam">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
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
function Cta({ station }: { station: Station }) {
  const pitch =
    station.source === 'chs'
      ? 'Slackwater shows tides and tidal currents on your phone — tides worldwide, currents across the US and Canada.'
      : 'Slackwater predicts tides and currents offline, on your phone — tides worldwide, currents across the US and Canada.'
  return (
    <section className="mt-14 border-t border-sw-steel/15 pt-8">
      <p className="text-sw-steel">{pitch}</p>
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
