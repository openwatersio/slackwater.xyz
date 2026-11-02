import { useEffect, useMemo, useRef, useState } from 'react'
import { DayStrip, type Fetched } from './DayStrip'
import { NearbyMap } from './NearbyMap'
import { DATUM_NOTE, datumLine, refinedRowsNote, requiresBeta, seasonalNote, stationHeading } from '#/lib/copy'
import { compass16, dayLabel, dayStart, height, hhmm, shiftLocalDay } from '#/lib/format'
import { fetchGateCurrent, fetchPortTides } from '#/lib/iwls'
import { APP_STORE, ORIGIN, REQUIREMENT, TESTFLIGHT_BETA } from '#/lib/links'
import type { Crumb, NearbyRow } from '#/lib/catalogue-server'
import type { PassGuide } from '#/lib/passes'
import { findEvents, tideExtremes, type StationEvent, type TideExtreme } from '#/lib/predict'
import { fetchRefinement, type Refined } from '#/lib/refine'
import type { BundledStation, ChsStation, Station } from '#/lib/station'
import { instantPath } from '#/routes/instant-url'

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

/** Where a current page sends a reader who doesn't know what its slack times mean. */
const SLACK_GUIDE = '/learn/slack-water/'

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
  /** The pages above this one, from the kind's index down to the station's place. */
  crumbs?: Crumb[]
  /** A CHS pass's written guide, where one exists — see `passes.ts`. */
  guide?: PassGuide
  /**
   * CHS's day for a computed station, already in hand. A page never gets one
   * from a loader — that would be prerendering it — so in practice this is
   * how a test renders what the reader's browser shows once the fetch lands.
   */
  refined?: Refined
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
export function StationPage({ station, now, selectedAt: initialSelection, live = false, settled = live, nearby = [], crumbs = [], guide, refined: initialRefined }: Props) {
  const [selectedAt, setSelectedAt] = useState(initialSelection ?? now)
  const [trackingNow, setTrackingNow] = useState(initialSelection === undefined)
  useEffect(() => {
    if (trackingNow) setSelectedAt(now)
  }, [trackingNow, now])
  // Held here rather than in `ChsGate` because the subtitle is here: a page
  // that has just gained a chart also gains the date that chart needs.
  const [curve, setCurve] = useState<Curve | undefined>()
  const layer = useRefinement(station, now, settled, initialRefined)
  // The moment the page is ABOUT, which stops being the live clock the instant
  // a Canadian curve arrives: DFO sent one fixed day, and the frame, the date
  // and the numbers all have to be that same day or the page contradicts
  // itself. `now` keeps ticking underneath, which is what the NOW marker and
  // the countdown want.
  const at = station.source === 'bundled' ? selectedAt : curve?.at ?? now
  const select = (next: Date) => {
    setTrackingNow(false)
    setSelectedAt(next)
  }
  const commit = (next: Date) => {
    select(next)
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', instantPath(station.path, next, station.timezone))
    }
  }
  const returnToNow = () => {
    setTrackingNow(true)
    setSelectedAt(now)
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', station.path)
    }
  }
  const note = seasonalNote(station)
  const lead = note?.place === 'lead' ? note : undefined
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-6 sm:pt-14 print:max-w-none print:p-0">
      <Breadcrumb station={station} crumbs={crumbs} />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-sw-paper sm:text-5xl print:mt-0 print:text-2xl">
        {stationHeading(station)}
      </h1>
      <p className="mt-3 text-sw-steel print:mt-1 print:text-sm">
        {station.kind === 'tide' ? 'Tide times & tide chart' : (
          <>Tidal currents &amp; <a href={SLACK_GUIDE} className="underline decoration-sw-steel/60 underline-offset-4 hover:text-sw-foam">slack water</a></>
        )}
      </p>
      {/* Above the curve rather than below it: at these stations the annual
          cycle IS the signal, so a reader needs it before reading a high and a
          low, not after. The quieter band renders in `Facts` instead. */}
      {lead && <p className="mt-3 text-sw-foam">{lead.text}</p>}
      {station.source === 'chs' ? (
        !curve ? (
          <ChsGate station={station} now={now} settled={settled} hours={24} onCurve={setCurve} />
        ) : (
          <div className="mt-8">
            <DayStrip station={station} fetched={curve} start={startOf(at)} hours={24} now={now} live={live} />
          </div>
        )
      ) : (
        <div className="print:hidden">
          <StationDayPager
            station={station}
            selectedAt={selectedAt}
            actualNow={now}
            live={live}
            trackingNow={trackingNow}
            showSelection={live || initialSelection !== undefined}
            refined={layer.refined}
            onSelect={select}
            onCommit={commit}
            onNow={returnToNow}
          />
          {/* Only while the request is actually in flight, so the page we
              serve says nothing about a fetch that has not started. The words
              are the privacy policy's. A failure says nothing at all: the
              computed curve is still a real prediction, and stays. */}
          {layer.inFlight && (
            <p className="mt-3 text-sm text-sw-steel">
              Your browser is fetching today&rsquo;s predictions directly from the Canadian
              Hydrographic Service. Nothing is sent to us.{' '}
              <button type="button" onClick={layer.cancel} className="underline underline-offset-4 hover:text-sw-foam">
                Cancel
              </button>
            </p>
          )}
        </div>
      )}
      <p className="mt-6 text-sm leading-relaxed text-sw-steel print:mt-2">
        Predictions are not observations — conditions vary with weather and river flow.{' '}
        <strong className="font-semibold text-sw-foam">Not for navigation.</strong>
      </p>
      {guide && <Guide guide={guide} />}
      <Cta station={station} />
      {station.source === 'bundled' && <WeekTable station={station} at={at} refined={layer.refined} />}
      <Facts station={station} />
      <Nearby station={station} rows={nearby} />
      {/* Paper loses the address bar, so the sheet carries the link back. The
          date waits for the reader's own clock: a served page would otherwise
          print the day the site was built. */}
      <p className="mt-4 hidden text-sm text-sw-steel print:block">
        {ORIGIN}{station.path}
        {live && <> · Printed {dayLabel(now, station.timezone)}</>}
      </p>
    </main>
  )
}

/**
 * Every segment of the station's path, each a real page: the kind's index, the
 * country, the subdivision where there is one. `json-ld.ts` emits the same
 * items — keep them in step.
 */
function Breadcrumb({ station, crumbs }: { station: Station; crumbs: Crumb[] }) {
  const trail = crumbs.length ? crumbs : [kindIndex(station)]
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-sw-steel print:hidden">
      <ol className="flex flex-wrap gap-x-2">
        <li><a href="/" className="hover:text-sw-paper">Slackwater</a></li>
        {trail.map((c) => (
          <li key={c.href} className="contents">
            <span aria-hidden="true">›</span>
            <a href={c.href} className="hover:text-sw-paper">{c.label}</a>
          </li>
        ))}
        <li aria-hidden="true">›</li>
        <li aria-current="page" className="text-sw-foam">{station.name}</li>
      </ol>
    </nav>
  )
}

const kindIndex = (station: Station): Crumb =>
  station.kind === 'tide'
    ? { href: '/tides/', label: 'Tide stations' }
    : { href: '/currents/', label: 'Current stations' }

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
  return rowsOf(station, station.kind === 'tide'
    ? { kind: 'tide', turns: tideExtremes(station, from, hoursBetween(from, to)) }
    : { kind: 'current', events: findEvents(station, from, hoursBetween(from, to)) })
}

/** Table rows from a tide's turns or a current's events, whichever source they came from. */
function rowsOf(
  station: BundledStation,
  from: { kind: 'tide'; turns: TideExtreme[] } | { kind: 'current'; events: StationEvent[] },
) {
  const tz = station.timezone
  return (from.kind === 'tide'
    ? from.turns.map((e) => ({
        time: e.time,
        what: e.high ? 'High' : 'Low',
        value: `${height(e.level)} ft` as string | undefined,
      }))
    : from.events.map((e) => ({
        time: e.time,
        what: e.kind === 'slack' ? 'Slack' : `Max ${e.kind}`,
        value: e.kind === 'slack' ? undefined : `${Math.abs(e.level).toFixed(1)} kn`,
      }))
  ).map((t) => ({ ...t, hhmm: hhmm(t.time, tz), chs: false }))
}

/**
 * The week's rows with CHS's day in place of the computed rows it covers.
 *
 * The same day the chart swaps, from the same fetch, so the chart and today's
 * rows never disagree. Every row outside that window is untouched, and every
 * row inside it is CHS's: mixing the two inside one day would interleave two
 * models' turns minutes apart.
 */
function refineRows(station: BundledStation, rows: ReturnType<typeof turns>, refined?: Refined) {
  if (!refined) return rows
  const from = refined.start.getTime()
  const to = from + refined.hours * 3600_000
  const inside = (t: Date) => t.getTime() >= from && t.getTime() < to
  const chs = rowsOf(station, refined)
    .filter((r) => inside(r.time))
    .map((r) => ({ ...r, chs: true }))
  if (!chs.length) return rows
  return [...rows.filter((r) => !inside(r.time)), ...chs].sort((a, b) => a.time.getTime() - b.time.getTime())
}

function StationDayPager({
  station, selectedAt, actualNow, live, trackingNow, showSelection, refined, onSelect, onCommit, onNow,
}: {
  station: BundledStation
  selectedAt: Date
  actualNow: Date
  live: boolean
  trackingNow: boolean
  showSelection: boolean
  /** CHS's day, drawn by the strip only when it is the day on screen. */
  refined?: Refined
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
  const button = 'min-w-0 rounded-full px-2 py-2 text-sm hover:text-sw-foam focus-visible:ring-2 focus-visible:ring-sw-foam'
  return (
    <div className="mt-8">
      <nav aria-label={`Choose ${station.kind} day`} className="grid grid-cols-3 items-center gap-x-1">
        {[-1, 0, 1].map((offset) => (
          <button
            key={offset}
            type="button"
            aria-current={offset === 0 ? 'date' : undefined}
            onClick={() => offset && onCommit(shiftLocalDay(selectedAt, tz, offset))}
            className={`${button} row-start-1 ${offset === 0 ? 'bg-white/10 text-sw-paper' : 'text-sw-steel'}`}
          >
            {offset < 0 && <span aria-hidden="true">‹ </span>}
            {label(offset)}
            {offset > 0 && <span aria-hidden="true"> ›</span>}
          </button>
        ))}
        {live && !trackingNow && (
          <button
            type="button"
            onClick={onNow}
            className={`row-start-2 mt-1 rounded-full px-3 py-1 text-sm text-sw-steel hover:text-sw-foam ${actualNow < selectedAt ? 'col-start-1 justify-self-end' : 'col-start-3 justify-self-start'}`}
          >
            Now
          </button>
        )}
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
          refined={refined}
          onSelect={onSelect}
          onCommit={onCommit}
        />
      </section>
    </div>
  )
}

/**
 * Seven days of turns, visible rather than tabbed: this is the page's
 * long-tail content, and text a crawler has to toggle for carries less weight.
 */
function WeekTable({ station, at, refined }: { station: BundledStation; at: Date; refined?: Refined }) {
  const tz = station.timezone
  const week = days(at, tz, 7)
  const computed = useMemo(() => turns(station, week[0], week[7]), [station, week[0].getTime()])
  const rows = useMemo(() => refineRows(station, computed, refined), [station, computed, refined])
  const marked = rows.some((r) => r.chs)
  const tide = station.kind === 'tide'
  let lastDay = ''
  return (
    <section className="mt-14 print:mt-4">
      <h2 className="text-xl font-semibold text-sw-paper print:text-base">
        {tide ? 'Tide times for the next 7 days' : 'Slack water and maximums for the next 7 days'}
      </h2>
      <table className="mt-4 w-full text-sm print:mt-1 print:block">
        <caption className="pb-3 text-left leading-relaxed text-sw-steel print:block print:pb-2 print:text-xs">
          {dayLabel(week[0], tz)} through {dayLabel(week[6], tz)}.
          {' '}All times are local to {station.name} ({tz}).
          {tide && station.chartDatum && <> Heights are in feet above {station.chartDatum}.</>}
          {marked && <> {refinedRowsNote(station)}</>}
          {!tide && (
            <>
              {' '}
              <a href={SLACK_GUIDE} className="underline underline-offset-4 hover:text-sw-foam print:no-underline">
                What slack water is, and why it isn&rsquo;t high or low tide
              </a>
              .
            </>
          )}
        </caption>
        <thead className="text-left text-xs uppercase tracking-wider text-sw-leaf print:hidden">
          <tr>
            <th className="py-2 pr-3 font-medium">Day</th>
            <th className="py-2 pr-3 font-medium">{tide ? 'Tide' : 'Current'}</th>
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 font-medium">{tide ? 'Height' : 'Speed'}</th>
          </tr>
        </thead>
        <tbody className="tabular-nums print:block print:columns-2 print:gap-10">
          {rows.map((t) => {
            const day = dayLabel(t.time, tz)
            const first = day !== lastDay
            lastDay = day
            return (
              <tr
                key={`${t.chs ? 'chs' : 'computed'}-${t.time.getTime()}`}
                className={`print:grid print:break-inside-avoid print:grid-cols-[8rem_5rem_3.5rem_1fr] ${first ? 'border-t border-sw-steel/20' : ''}`}
                data-source={t.chs ? 'chs' : undefined}
              >
                <td className="py-1.5 pr-3 text-sw-steel print:py-px">{day}</td>
                <td className="py-1.5 pr-3 print:py-px">{t.what}</td>
                <td className="py-1.5 pr-3 print:py-px"><time dateTime={t.time.toISOString()}>{t.hhmm}</time></td>
                <td className="py-1.5 print:py-px">
                  {t.value ?? ''}
                  {/* The row-level mark the caption explains. */}
                  {t.chs && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-sw-steel">CHS</span>}
                </td>
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
  // The band that does not lead the page says it here, beside the datum note,
  // because it is the same kind of fact: what these heights are measured
  // against and how they behave over a year.
  const note = seasonalNote(station)
  const aside = note?.place === 'aside' ? note : undefined
  const position =
    `${Math.abs(station.latitude).toFixed(4)}° ${station.latitude >= 0 ? 'N' : 'S'}, ` +
    `${Math.abs(station.longitude).toFixed(4)}° ${station.longitude >= 0 ? 'E' : 'W'}`
  const where = [station.state, station.country].filter(Boolean).join(', ')
  const reductionSource = bundled && station.reduction && (() => {
    const [reference, bin] = station.reduction.referenceId.replace(/^noaa\//, '').split('@')
    return `NOAA current table reduction from ${reference}${bin ? `, bin ${bin}` : ''}`
  })() || (bundled && station.tideReduction &&
    `NOAA tide offsets from ${station.tideReduction.referenceId.replace(/^noaa\//, '')}`)
  const rows: [string, string | undefined][] = [
    ['Position', position],
    ['Time zone', station.timezone],
    ['Datum', datum],
    ['Source', reductionSource || (bundled ? (station.kind === 'tide' ? `Harmonic constituents from ${station.publisher || 'the tide database'}` : 'NOAA harmonic constituents') : 'Canadian Hydrographic Service')],
    [station.state ? 'Region' : 'Country', where || undefined],
  ]
  const sourceUrl = bundled
    ? station.kind === 'tide'
      ? 'https://github.com/openwatersio/slackwater-database#sources'
      : 'https://tidesandcurrents.noaa.gov/noaacurrents/'
    : 'https://tides.gc.ca/en/tides-currents-and-water-levels'
  return (
    <section className="mt-14 print:mt-4">
      <h2 className="text-xl font-semibold text-sw-paper print:text-base">Station facts</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm print:mt-1 print:gap-y-0 print:text-xs">
        {rows.map(([k, v]) => v && (
          <div key={k} className="contents">
            <dt className="text-sw-steel">{k}</dt>
            <dd className="text-sw-foam">
              {k === 'Source' ? <a href={sourceUrl} className="underline underline-offset-4 hover:text-sw-paper">{v}</a> : v}
            </dd>
          </div>
        ))}
      </dl>
      {datum && <p className="mt-3 text-sm text-sw-steel/70">{DATUM_NOTE}</p>}
      {aside && <p className="mt-3 text-sm text-sw-steel/70">{aside.text}</p>}
      {bundled && station.attribution && <p className="mt-3 break-words text-sm text-sw-steel/70">{station.attribution}</p>}
      <p className="mt-3 text-sm text-sw-steel print:hidden">
        <a href="/accuracy/" className="underline underline-offset-4 hover:text-sw-paper">How we check predictions</a>
        {' '}— dated samples and their limits.
      </p>
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
 * The panel describes coverage without naming the app's per-gate mechanism (#44); the curve caption credits the official predictions fetched by the browser.
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
        fetched under DFO&rsquo;s own terms.{' '}
        {requiresBeta(station.id)
          ? `${station.name} is available in the Slackwater beta on TestFlight.`
          : 'Slackwater covers this water in the app.'}
      </p>
      {(inFlight || stopped) && (
        <div className="mt-5 print:hidden">
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
 * CHS's day for a computed station that carries a CHS identity, fetched by
 * the reader's browser once its clock is its own.
 *
 * The same posture as `ChsGate`: a plain browser `fetch()` straight to IWLS,
 * never proxied, prerendered or stored, and stoppable while in flight. What
 * differs is what the page has meanwhile. A CHS-only page has nothing to show
 * until DFO answers; this one already shows a computed curve, so a slow or
 * failed request leaves it exactly as served rather than raising an error.
 *
 * One request per page view, for the reader's own day. Paging to another day
 * shows the computed curve there instead of asking DFO again: IWLS documents
 * caps of 3 requests a second and 30 a minute, and each fetch starts with an
 * 82 KB station list.
 */
function useRefinement(station: Station, now: Date, settled: boolean, initial?: Refined) {
  const [refined, setRefined] = useState(initial)
  const [inFlight, setInFlight] = useState(false)
  const [stopped, setStopped] = useState(false)
  // Read at fetch time, deliberately NOT a dependency — see `ChsGate`.
  const at = useRef(now)
  at.current = now
  const target = station.source === 'bundled' && station.chs ? station : undefined
  const have = refined !== undefined

  useEffect(() => {
    // Not until the clock is the reader's own: fetching against the build-time
    // placeholder would draw the day the site was built.
    if (!target || !settled || stopped || have) return
    const stop = new AbortController()
    setInFlight(true)
    fetchRefinement(target, at.current, (url) => fetch(url, { signal: stop.signal }))
      .then(setRefined)
      // The computed curve is already on screen and still true. A failure, a
      // cancel, or a port DFO no longer resolves leaves it there.
      .catch(() => undefined)
      .finally(() => {
        if (!stop.signal.aborted) setInFlight(false)
      })
    return () => {
      stop.abort()
      setInFlight(false)
    }
  }, [target, settled, stopped, have])

  return { refined, inFlight, cancel: () => setStopped(true) }
}

/** The prose a guide renders, styled once for its sections, questions and sources. */
const PROSE =
  'leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel/40 [&_a]:underline-offset-4 [&_a:hover]:text-sw-paper ' +
  '[&_h2]:mt-12 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 ' +
  '[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-2 [&_strong]:font-semibold [&_strong]:text-sw-paper'

/**
 * A pass explained without its predictions: how the water behaves, how slack
 * works there, how people plan the transit, and the questions they ask — each
 * claim sourced, none of it a DFO number. Server-rendered from markdown in
 * `src/content/passes/`, so the page a crawler reads already says it.
 */
function Guide({ guide }: { guide: PassGuide }) {
  return (
    <section className="mt-2">
      <div className={PROSE} dangerouslySetInnerHTML={{ __html: guide.html }} />
      {guide.faq.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold text-sw-paper">Questions</h2>
          {guide.faq.map((q) => (
            <div key={q.question} className="mt-6">
              <h3 className="font-semibold text-sw-paper">{q.question}</h3>
              <div className={`${PROSE} [&>p:first-child]:mt-2`} dangerouslySetInnerHTML={{ __html: q.html }} />
            </div>
          ))}
        </>
      )}
      {guide.sources && (
        <div className={`${PROSE} text-sm text-sw-steel [&_h2]:text-base`} dangerouslySetInnerHTML={{ __html: guide.sources }} />
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
  const all = kindIndex(station).href
  return (
    <section className="mt-14 print:hidden">
      <h2 className="text-xl font-semibold text-sw-paper">Nearby</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.slug} className="flex items-baseline justify-between gap-3">
            <span>
              <a href={r.path} className="text-sw-paper/90 underline underline-offset-4 decoration-sw-steel/40 hover:text-sw-leaf">
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
        rows={rows.map((r) => ({ name: r.name, latitude: r.latitude, longitude: r.longitude, href: r.path }))}
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
  const beta = requiresBeta(station.id)
  // A computed page that carries a CHS identity pitches as a CHS page does:
  // nothing published says how the app answers for a Canadian station (#44),
  // so neither page says "offline".
  const pitch = beta
    ? `Try ${station.name} in the Slackwater beta on TestFlight.`
    : station.source === 'chs' || station.chs
      ? 'Slackwater shows tides and tidal currents on your phone — tides worldwide, currents across the US and Canada.'
      : 'Slackwater predicts tides and currents offline, on your phone — tides worldwide, currents across the US and Canada.'
  return (
    <section className="mt-14 border-t border-sw-steel/15 pt-8 print:hidden">
      <p className="text-sw-steel">{pitch}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={beta ? TESTFLIGHT_BETA : APP_STORE}
          className="rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          {beta ? 'Join the TestFlight beta' : 'Download on the App Store'}
        </a>
        <a
          href="/"
          className="whitespace-nowrap text-sw-steel underline underline-offset-4 transition hover:text-sw-paper"
        >
          Slackwater
        </a>
      </div>
      <p className="mt-3 text-sm text-sw-steel">{REQUIREMENT}</p>
    </section>
  )
}
