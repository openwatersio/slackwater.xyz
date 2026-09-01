import { useEffect, useRef, useState } from 'react'
import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { dayLabel } from '#/lib/format'
import { fetchGateCurrent, fetchPortTides } from '#/lib/iwls'
import { TESTFLIGHT } from '#/lib/links'
import type { StationRow } from '#/lib/catalogue-server'
import type { Sample, StationEvent } from '#/lib/predict'
import type { ChsStation, Station } from '#/lib/station'

/**
 * One Canadian station's day, once DFO has sent it back.
 *
 * A gate carries the published slacks and maxima; a port carries the published
 * high and low. Neither is derived from the samples, because DFO states both
 * outright and a fifteen-minute grid only samples them.
 *
 * `at` is the moment it was fetched for. Carried, rather than the page reading
 * its own live clock, because it answers two questions that must not diverge:
 * which 24 hours the frame covers, and which date the page prints. DFO sent a
 * fixed day; a clock that keeps moving would slide the frame off the end of it
 * and, worse, date the page differently from the water it drew.
 */
type Curve = { at: Date } & (
  | { kind: 'current'; samples: Sample[]; events: StationEvent[] }
  | { kind: 'tide'; samples: Sample[]; high: Sample; low: Sample }
)

/**
 * How far before `now` a chart begins — six hours behind, eighteen ahead.
 *
 * One definition, because `ChsGate` has to ask DFO for exactly the window the
 * page will draw. Two copies of `- 6 * 3600_000` is how the fetched day and
 * the drawn frame drift apart by a constant nobody notices.
 */
const startOf = (at: Date) => new Date(at.getTime() - 6 * 3600_000)

interface Props {
  station: Station
  /** The moment the page is centred on: the reader's clock, or a shared instant. */
  now: Date
  /** True only on a hydrated client — see `useLiveNow`. */
  live?: boolean
  /**
   * True when `now` is the moment this page will keep.
   *
   * False for a server render and for the first client render of a live page,
   * where `now` is `useLiveNow`'s build-time placeholder and is about to be
   * replaced by the reader's own clock. Merely DRAWING that placeholder is
   * harmless — it is replaced a tick later. GOING AND FETCHING a day for it is
   * not: the request is made once, so it asks DFO for the day the site was
   * built and the page then draws eleven-day-old water under today's date.
   * An instant route sets this from the first render: its moment came from the
   * URL and nothing will replace it.
   */
  settled?: boolean
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
export function StationPage({ station, now, live = false, settled = live, nearby = [] }: Props) {
  // Held here rather than in `ChsGate` because the subtitle is here: a page
  // that has just gained a chart also gains the date that chart needs.
  const [curve, setCurve] = useState<Curve | undefined>()
  // The moment the page is ABOUT, which stops being the live clock the instant
  // a Canadian curve arrives: DFO sent one fixed day, and the frame, the date
  // and the numbers all have to be that same day or the page contradicts
  // itself. `now` keeps ticking underneath, which is what the NOW marker and
  // the countdown want.
  const at = curve?.at ?? now
  const start = startOf(at)
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
  const date = station.source === 'bundled' || curve ? dayLabel(at, station.timezone) : undefined
  const subtitle = [station.region, date].filter(Boolean).join(' · ')
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{subtitle}</p>
      {station.source === 'chs' ? (
        !curve ? (
          <ChsGate station={station} now={now} settled={settled} hours={24} onCurve={setCurve} />
        ) : curve.kind === 'tide' ? (
          <TideCurve
            station={station} start={start} hours={24} now={now}
            samples={curve.samples} high={curve.high} low={curve.low}
          />
        ) : (
          <CurrentCurve
            station={station} start={start} hours={24} now={now} live={live}
            samples={curve.samples} events={curve.events}
          />
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
 * A Canadian station, named but not predicted — and the request that goes and
 * gets the prediction from DFO.
 *
 * CHS predictions are fetched by each user under DFO's own terms and never
 * re-served, so THE PAGE WE SERVE still ships identity and nothing else: no
 * curve is prerendered, none is proxied through the Worker, and none is stored
 * by us. The moment we fetch it, we are re-serving. What changed is only who
 * starts the clock — the reader's own browser now asks on load rather than
 * waiting for a click, and can stop it while it is in flight.
 *
 * That is a privacy change, not a licensing one, and `src/content/privacy.md`
 * carries it. The request is still the visitor's, still straight to
 * `api-iwls.dfo-mpo.gc.ca`, and still never touches us.
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
  now,
  settled,
  hours,
  onCurve,
}: {
  station: ChsStation
  now: Date
  settled: boolean
  hours: number
  onCurve: (curve: Curve) => void
}) {
  // Both false on the server and on the first client render, so the page we
  // SERVE carries no control at all — it is the identity page #43 shipped,
  // byte for byte. A reader with JS off, or one whose hydration failed, is
  // then told nothing untrue: no Cancel button for a request that is not
  // happening, and no sentence in the present tense about a fetch that never
  // started.
  const [stopped, setStopped] = useState(false)
  const [inFlight, setInFlight] = useState(false)
  const [error, setError] = useState<string>()
  // Read at fetch time, deliberately NOT a dependency. `now` is a new moment
  // every tick, and a tick is not a reason to ask DFO for another day.
  const at = useRef(now)
  at.current = now

  useEffect(() => {
    // Not until the clock is the reader's own. Fetching against the build-time
    // placeholder asks for the day the site was built — the request succeeds,
    // the curve draws, every count is green, and the water is weeks old.
    if (!settled || station.derived || stopped) return
    // A derived gate has no CHS current station to ask about — its slack is a
    // reference port's high and low water plus a fixed lag — so it never asks,
    // rather than starting a request that could only fail.
    const moment = at.current
    const stop = new AbortController()
    const signalled: typeof fetch = (url) => fetch(url, { signal: stop.signal })
    setInFlight(true)
    // Same posture, two series: a gate's signed velocity from `wcsp1`/`wcdp1`,
    // a port's heights from `wlp`. Both go straight from this browser to DFO.
    const day =
      station.kind === 'tide'
        ? fetchPortTides(station, startOf(moment), hours, signalled).then(
            (c) => ({ kind: 'tide', ...c }) as const,
          )
        : fetchGateCurrent(station, startOf(moment), hours, signalled).then(
            (c) => ({ kind: 'current', ...c }) as const,
          )
    day
      .then((curve) => onCurve({ ...curve, at: moment }))
      .catch((e) => {
        // A cancel rejects too. The reader asked for that and does not need to
        // be told it worked.
        if (stop.signal.aborted) return
        // Otherwise the thrown message is the sentence the reader should see:
        // past the resolution tolerance it says there is no station here, and
        // must not be flattened into a generic failure inviting a retry that
        // cannot succeed.
        setError(e instanceof Error ? e.message : 'The predictions could not be loaded.')
        setInFlight(false)
        setStopped(true)
      })
    // Cancelling has to stop the request, not just stop showing it.
    return () => stop.abort()
  }, [settled, stopped, station, hours, onCurve])

  return (
    <section className="mt-10 rounded-lg border border-sw-steel/20 p-6">
      <p className="text-sw-foam">
        Predictions for {station.name} are based on Canadian Hydrographic Service data,
        fetched under DFO&rsquo;s own terms. Slackwater covers this water in the app.
      </p>
      {(inFlight || stopped) && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => {
              setError(undefined)
              setInFlight(false)
              setStopped(!stopped)
            }}
            className="rounded-md border border-sw-leaf/40 px-5 py-3 font-medium text-sw-foam transition hover:border-sw-leaf hover:text-sw-leaf"
          >
            {inFlight ? 'Cancel' : `Show today's ${station.kind === 'tide' ? 'tides' : 'currents'}`}
          </button>
          {/* Present tense only while it is actually in flight. This is the
              reader's browser contacting a third party, and the privacy policy
              says the same thing in the same words. */}
          <p className="mt-3 text-sm text-sw-steel">
            Your browser {inFlight ? 'is fetching' : 'fetches'} these directly from the
            Canadian Hydrographic Service. Nothing is sent to us.
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
