import { useEffect, useMemo, useRef, useState } from 'react'
import { DayStrip, type Fetched } from './DayStrip'
import { NearbyMap } from './NearbyMap'
import { DATUM_NOTE, datumLine, stationHeading } from '#/lib/copy'
import { compass16, dayLabel, dayStart, height, hhmm, shiftLocalDay } from '#/lib/format'
import { fetchGateCurrent, fetchPortTides } from '#/lib/iwls'
import { TESTFLIGHT } from '#/lib/links'
import type { NearbyRow } from '#/lib/catalogue-server'
import { findEvents, tideExtremes } from '#/lib/predict'
import { stationPath, type BundledStation, type ChsStation, type Station } from '#/lib/station'
import { tideInstantPath } from '#/routes/instant-url'

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
type Curve = { at: Date } & Fetched

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
  /** The reader's clock. */
  now: Date
  /** A fixed moment from a shared URL. Omit to follow `now`. */
  selectedAt?: Date
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
  nearby?: NearbyRow[]
}

/**
 * One station, one moment — the body shared by all four station routes.
 *
 * The canonical and instant routes differ in their loader, canonical link and
 * card, not in what they draw, so the page itself lives here rather than in
 * four near-identical copies that can drift apart.
 *
 * Order is the argument: the selected day first, the app, then everything a
 * reader or a crawler goes on to want.
 */
export function StationPage({ station, now, selectedAt: initialSelection, live = false, settled = live, nearby = [] }: Props) {
  const [selectedAt, setSelectedAt] = useState(initialSelection ?? now)
  const [trackingNow, setTrackingNow] = useState(initialSelection === undefined)
  useEffect(() => {
    if (trackingNow) setSelectedAt(now)
  }, [trackingNow, now])
  // Held here rather than in `ChsGate` because the subtitle is here: a page
  // that has just gained a chart also gains the date that chart needs.
  const [curve, setCurve] = useState<Curve | undefined>()
  // The moment the page is ABOUT, which stops being the live clock the instant
  // a Canadian curve arrives: DFO sent one fixed day, and the frame, the date
  // and the numbers all have to be that same day or the page contradicts
  // itself. `now` keeps ticking underneath, which is what the NOW marker and
  // the countdown want.
  const at = station.source === 'bundled' && station.kind === 'tide'
    ? selectedAt
    : curve?.at ?? now
  const select = (next: Date) => {
    setTrackingNow(false)
    setSelectedAt(next)
  }
  const commit = (next: Date) => {
    select(next)
    if (typeof window !== 'undefined') {
      window.history.replaceState(
        window.history.state,
        '',
        tideInstantPath(station.slug, next, station.timezone),
      )
    }
  }
  const returnToNow = () => {
    setTrackingNow(true)
    setSelectedAt(now)
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', stationPath('tide', station.slug))
    }
  }
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-6 sm:pt-14">
      <Breadcrumb station={station} />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {stationHeading(station)}
      </h1>
      <p className="mt-3 text-sw-steel">
        {station.kind === 'tide' ? 'Tide times & tide chart' : 'Tidal currents & slack water'}
      </p>
      {station.source === 'chs' ? (
        !curve ? (
          <ChsGate station={station} now={now} settled={settled} hours={24} onCurve={setCurve} />
        ) : (
          <div className="mt-8">
            <DayStrip station={station} fetched={curve} start={startOf(at)} hours={24} now={now} live={live} />
          </div>
        )
      ) : station.kind === 'tide' ? (
        <TideDayPager
          station={station}
          selectedAt={selectedAt}
          actualNow={now}
          live={live}
          trackingNow={trackingNow}
          showSelection={live || initialSelection !== undefined}
          onSelect={select}
          onCommit={commit}
          onNow={returnToNow}
        />
      ) : (
        <DayTabs station={station} at={at} now={now} live={live} />
      )}
      <Cta station={station} />
      {station.source === 'bundled' && <WeekTable station={station} at={at} />}
      <Facts station={station} />
      <Nearby station={station} rows={nearby} />
    </main>
  )
}

/**
 * Real pages only. The country and region crumbs arrive with the geographic
 * hierarchy; until then a crumb pointing nowhere would be a broken link in the
 * one place search engines read links most carefully. `json-ld.ts` emits the
 * same three items — keep them in step.
 */
function Breadcrumb({ station }: { station: Station }) {
  const tide = station.kind === 'tide'
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-sw-steel">
      <ol className="flex flex-wrap gap-x-2">
        <li><a href="/" className="hover:text-sw-paper">Slackwater</a></li>
        <li aria-hidden="true">›</li>
        <li>
          <a href={tide ? '/stations/tides/' : '/stations/currents/'} className="hover:text-sw-paper">
            {tide ? 'Tide stations' : 'Current stations'}
          </a>
        </li>
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-sw-foam">{station.name}</li>
      </ol>
    </nav>
  )
}

/** The station-local day `at` falls in, and the ones after it. */
function days(at: Date, timeZone: string, count: number): Date[] {
  return Array.from({ length: count + 1 }, (_, i) => dayStart(at, timeZone, i))
}
const hoursBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600_000

/**
 * The day's turns, in order, as one sentence — for a tide, its highs and lows;
 * for a current, its slacks and maxima.
 */
function turns(station: BundledStation, from: Date, to: Date) {
  const tz = station.timezone
  return (station.kind === 'tide'
    ? tideExtremes(station, from, hoursBetween(from, to)).map((e) => ({
        time: e.time,
        what: e.high ? 'High' : 'Low',
        value: `${height(e.level)} ft`,
      }))
    : findEvents(station, from, hoursBetween(from, to)).map((e) => ({
        time: e.time,
        what: e.kind === 'slack' ? 'Slack' : `Max ${e.kind}`,
        value: e.kind === 'slack' ? undefined : `${Math.abs(e.level).toFixed(1)} kn`,
      }))
  ).map((t) => ({ ...t, hhmm: hhmm(t.time, tz) }))
}

function TideDayPager({
  station, selectedAt, actualNow, live, trackingNow, showSelection, onSelect, onCommit, onNow,
}: {
  station: BundledStation
  selectedAt: Date
  actualNow: Date
  live: boolean
  trackingNow: boolean
  showSelection: boolean
  onSelect: (at: Date) => void
  onCommit: (at: Date) => void
  onNow: () => void
}) {
  const tz = station.timezone
  const day = dayStart(selectedAt, tz)
  const next = dayStart(selectedAt, tz, 1)
  const sameDay = day.getTime() === dayStart(actualNow, tz).getTime()
  const label = (offset: number) => {
    if (live && sameDay) return ['Yesterday', 'Today', 'Tomorrow'][offset + 1]
    return dayLabel(dayStart(selectedAt, tz, offset), tz)
  }
  const button = 'min-w-0 flex-1 rounded-full px-2 py-2 text-sm hover:text-sw-foam focus-visible:ring-2 focus-visible:ring-sw-foam'
  return (
    <div className="mt-8">
      {live && !trackingNow && (
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onNow} className="rounded-full px-3 py-1 text-sm text-sw-steel hover:text-sw-foam">
            Now
          </button>
        </div>
      )}
      <nav aria-label="Choose tide day" className="flex items-center gap-1">
        {[-1, 0, 1].map((offset) => (
          <button
            key={offset}
            type="button"
            aria-current={offset === 0 ? 'date' : undefined}
            onClick={() => offset && onCommit(shiftLocalDay(selectedAt, tz, offset))}
            className={`${button} ${offset === 0 ? 'bg-white/10 text-sw-paper' : 'text-sw-steel'}`}
          >
            {offset < 0 && <span aria-hidden="true">‹ </span>}
            {label(offset)}
            {offset > 0 && <span aria-hidden="true"> ›</span>}
          </button>
        ))}
      </nav>
      <section className="mt-4" aria-label={dayLabel(day, tz)}>
        <DayStrip
          station={station}
          start={day}
          hours={hoursBetween(day, next)}
          now={actualNow}
          live={live}
          selectedAt={showSelection ? selectedAt : undefined}
          trackingNow={trackingNow}
          onSelect={onSelect}
          onCommit={onCommit}
        />
      </section>
    </div>
  )
}

/**
 * Today and tomorrow, both in the HTML, switched by two radio inputs styled
 * as tabs. No script runs the switch — it works before hydration and in a
 * crawler — and there is one URL, so the canonical stays clean.
 *
 * The words "Today" and "Tomorrow" only when the clock is the reader's own:
 * a prerender's today is the build day, and an instant page is one fixed
 * moment, so both show dates instead.
 */
function DayTabs({ station, at, now, live }: { station: BundledStation; at: Date; now: Date; live: boolean }) {
  const tz = station.timezone
  const [d0, d1, d2] = days(at, tz, 2)
  const label = (day: Date, word: string) => (live ? word : dayLabel(day, tz))
  const tab = 'inline-block cursor-pointer rounded-full px-3 py-1 text-sm text-sw-steel hover:text-sw-foam'
  return (
    <div className="mt-8">
      <input type="radio" name="day" id="day-0" className="peer/d0 sr-only" defaultChecked />
      <input type="radio" name="day" id="day-1" className="peer/d1 sr-only" />
      <label htmlFor="day-0" className={`${tab} peer-checked/d0:bg-white/10 peer-checked/d0:text-sw-paper peer-focus-visible/d0:ring-2`}>
        {label(d0, 'Today')}
      </label>
      <label htmlFor="day-1" className={`${tab} ml-1 peer-checked/d1:bg-white/10 peer-checked/d1:text-sw-paper peer-focus-visible/d1:ring-2`}>
        {label(d1, 'Tomorrow')}
      </label>
      <section className="mt-4 hidden peer-checked/d0:block" aria-label={dayLabel(d0, tz)}>
        <DayStrip station={station} start={d0} hours={hoursBetween(d0, d1)} now={now} live={live} />
      </section>
      <section className="mt-4 hidden peer-checked/d1:block" aria-label={dayLabel(d1, tz)}>
        <DayStrip station={station} start={d1} hours={hoursBetween(d1, d2)} now={now} live={live} />
      </section>
    </div>
  )
}

/**
 * Seven days of turns, visible rather than tabbed: this is the page's
 * long-tail content, and text a crawler has to toggle for carries less weight.
 */
function WeekTable({ station, at }: { station: BundledStation; at: Date }) {
  const tz = station.timezone
  const week = days(at, tz, 7)
  const rows = useMemo(() => turns(station, week[0], week[7]), [station, week[0].getTime()])
  const tide = station.kind === 'tide'
  let lastDay = ''
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold text-sw-paper">
        {tide ? 'Tide times for the next 7 days' : 'Slack water and maximums for the next 7 days'}
      </h2>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-sw-leaf">
          <tr>
            <th className="py-2 pr-3 font-medium">Day</th>
            <th className="py-2 pr-3 font-medium">{tide ? 'Tide' : 'Current'}</th>
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 font-medium">{tide ? 'Height' : 'Speed'}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((t) => {
            const day = dayLabel(t.time, tz)
            const first = day !== lastDay
            lastDay = day
            return (
              <tr key={t.time.getTime()} className={first ? 'border-t border-sw-steel/20' : ''}>
                <td className="py-1.5 pr-3 text-sw-steel">{first ? day : ''}</td>
                <td className="py-1.5 pr-3">{t.what}</td>
                <td className="py-1.5 pr-3">{t.hhmm}</td>
                <td className="py-1.5">{t.value ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

/**
 * What a reader who came for the numbers wants next: where exactly, against
 * what, in whose time, from whom. A Canadian page names no datum here — see
 * `datumLine` — and no mechanism, see `ChsGate`.
 */
function Facts({ station }: { station: Station }) {
  const bundled = station.source === 'bundled'
  const datum = bundled && station.kind === 'tide' ? datumLine(station) : undefined
  const position =
    `${Math.abs(station.latitude).toFixed(4)}° ${station.latitude >= 0 ? 'N' : 'S'}, ` +
    `${Math.abs(station.longitude).toFixed(4)}° ${station.longitude >= 0 ? 'E' : 'W'}`
  const where = [station.state, station.country].filter(Boolean).join(', ')
  const rows: [string, string | undefined][] = [
    ['Position', position],
    ['Time zone', station.timezone],
    ['Datum', datum],
    ['Source', bundled ? (station.kind === 'tide' ? 'Harmonic constituents from the tide database' : 'NOAA harmonic constituents') : 'Canadian Hydrographic Service'],
    [station.state ? 'Region' : 'Country', where || undefined],
  ]
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold text-sw-paper">Station facts</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([k, v]) => v && (
          <div key={k} className="contents">
            <dt className="text-sw-steel">{k}</dt>
            <dd className="text-sw-foam">{v}</dd>
          </div>
        ))}
      </dl>
      {datum && <p className="mt-3 text-sm text-sw-steel/70">{DATUM_NOTE}</p>}
    </section>
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
 * thing linking station pages to each other — without it all 5,624 are
 * reachable from the sitemap and nothing else.
 */
function Nearby({ station, rows }: { station: Station; rows: NearbyRow[] }) {
  if (!rows.length) return null
  const all = station.kind === 'tide' ? '/stations/tides/' : '/stations/currents/'
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold text-sw-paper">Nearby</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-baseline justify-between gap-3">
            <span>
              <a href={stationPath(station.kind, r.slug)} className="text-sw-paper/90 underline underline-offset-4 decoration-sw-steel/40 hover:text-sw-leaf">
                {r.name}
              </a>
              {r.region && <span className="ml-2 text-sm text-sw-steel">{r.region}</span>}
            </span>
            <span className="whitespace-nowrap text-sm tabular-nums text-sw-steel">
              {r.nm.toFixed(1)} nm {compass16(r.bearing)}
            </span>
          </li>
        ))}
      </ul>
      <NearbyMap
        station={station}
        rows={rows.map((r) => ({ name: r.name, latitude: r.latitude, longitude: r.longitude, href: stationPath(station.kind, r.slug) }))}
      />
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
 * The home link is not decoration: without it all 5,624 station pages are
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
