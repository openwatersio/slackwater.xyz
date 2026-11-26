import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedCallback } from '@slackwater/react'
import { NearbyMap } from './NearbyMap'
import { FindWater } from './FindWater'
import { STRIP_AFTER_HOURS, STRIP_BEFORE_HOURS, StationStrip } from './StationStrip'
import { StationTiles, useMomentStore, type MomentStore } from './StationTiles'
import { DATUM_NOTE, datumLine, provenance, refinedCredit, refinedRowsNote, requiresBeta, seasonalNote, stationHeading, WEB_ONLY_TIDE_SLUGS } from '#/lib/copy'
import { compass16, dayLabel, dayStart, height, hhmm } from '#/lib/format'
import { fetchGateCurrent, fetchPortTides } from '#/lib/iwls'
import { APP_STORE, ORIGIN, REQUIREMENT, TESTFLIGHT_BETA } from '#/lib/links'
import type { Crumb, NearbyRow } from '#/lib/catalogue-server'
import type { PassGuide } from '#/lib/passes'
import { findEvents, tideExtremes, type StationEvent, type TideExtreme } from '#/lib/predict'
import {
  computedReadings, joinInView, publishedReadings, seamFor, spliceReadings, tidyLayer, turnKind, type Published, type TurnKind,
} from '#/lib/readings'
import { fetchRefinement, type Refined } from '#/lib/refine'
import { mergeWindows } from '#/lib/chs-window'
import type { BundledStation, ChsStation, Station } from '#/lib/station'
import { instantPath } from '#/routes/instant-url'

/**
 * A CHS-only station's published predictions, bounded by the fetched samples.
 */
export type Curve = Published

/**
 * How far before the page's moment a CHS-only day begins — six hours behind,
 * eighteen ahead. The bounded strip draws whatever window this asked for.
 */
const startOf = (at: Date) => new Date(at.getTime() - 6 * 3600_000)

/**
 * How close to the reader's clock a selection may rest and still count as
 * now, in ms — the distance at which the strip itself stops offering its Now
 * pill. A page resting there keeps its canonical URL.
 */
const NEAR_NOW_MS = 200_000

/**
 * How long the strip must rest before the URL follows it. Dragging reports
 * every frame, and Safari throttles `history.replaceState` past a hundred
 * calls in thirty seconds.
 */
const URL_DEBOUNCE_MS = 500

/** Where a current page sends a reader who doesn't know what its slack times mean. */
const SLACK_GUIDE = '/learn/slack-water/'

interface Props {
  station: Station
  /** The reader's clock, or `useLiveNow`'s build-time placeholder until `live`. */
  now: Date
  /** A fixed moment from a shared URL: the strip opens on it. Omit to open on now. */
  selectedAt?: Date
  /** True only on a hydrated client — see `useLiveNow`. */
  live?: boolean
  /**
   * True when the moment a CHS day is fetched for is the one this page will
   * keep.
   *
   * False for a server render and for the first client render of a live page,
   * where `now` is `useLiveNow`'s build-time placeholder and is about to be
   * replaced by the reader's own clock. Merely DRAWING that placeholder is
   * harmless — it is replaced a tick later. GOING AND FETCHING a day for it is
   * not: the request is made once, so it asks DFO for the day the site was
   * built and the page then draws eleven-day-old water under today's date.
   * A CHS instant route sets this from the first render: its moment came from
   * the URL and nothing will replace it.
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
  /**
   * A CHS-only station's day, already in hand — like `refined`, never from a
   * loader, so in practice a test rendering what the browser shows once
   * `ChsGate`'s fetch lands.
   */
  fetched?: Curve
}

/**
 * One station, one moment — the body shared by all four station routes.
 *
 * The canonical and instant routes differ in their loader, canonical link and
 * card, not in what they draw, so the page itself lives here rather than in
 * four near-identical copies that can drift apart.
 *
 * Order is the argument: the strip first, the app, then everything a
 * reader or a crawler goes on to want.
 */
export function StationPage({ station, now, selectedAt, live = false, settled = live, nearby = [], crumbs = [], guide, refined: initialRefined, fetched }: Props) {
  const [curve, setCurve] = useState<Curve | undefined>(fetched)
  const more = useChsWindows(station, curve, setCurve, Boolean(fetched))
  const layer = useRefinement(station, now, settled, initialRefined)
  // The moment the page is about: the shared one, then wherever the reader
  // rests the strip, or undefined while it follows the reader's clock. The
  // 7-day table starts on its day, as the URL does.
  const [about, setAbout] = useState(selectedAt)
  const at = about ?? now
  const follow = useUrlSync(station, setAbout, live ? now.getTime() : undefined)
  const curveReadings = useMemo(() => curve && publishedReadings(curve), [curve])
  // Where the strip reads, for the tiles under it; it opens on the shared moment.
  const reading = useMomentStore(selectedAt?.getTime())
  // The strip's props, identical in the server render and the first client
  // render — no `now` until the clock is the reader's own, so the HTML claims
  // no present — and the moment a shared link fixed, which both open on. A
  // strip that remounts later opens on whatever the page is about by then.
  const moment = {
    now: live ? now.getTime() : undefined,
    selected: about?.getTime(),
    onMove: (time: number) => {
      follow.onMove(time)
      more.move(time)
    },
    onReading: reading.set,
    onNow: (time: number) => {
      // DFO's day can't reach now from a shared moment on another day. Now
      // is then the station's own page, loaded afresh: its request for
      // today's day starts when that page loads, as the privacy policy says,
      // and the day on screen stays until it does.
      if (curve && !covers(curve.samples, time)) return window.location.assign(station.path)
      follow.onNow(time)
    },
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
        !curveReadings ? (
          <ChsGate station={station} at={at} settled={settled} hours={24} onCurve={setCurve} />
        ) : (
          // Printed, as the fetched day always was: a CHS-only page has no
          // 7-day table to carry the numbers onto paper instead. Exact colour,
          // because the strip's ink is white on its own dark ground, and a
          // printer that drops backgrounds would leave white on white.
          <div className="mt-8 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
            <StationStrip station={station} readings={curveReadings} bounded {...moment} />
            {/* Visible, not only in the strip's spoken reading: these are
                DFO's own published numbers, and once the identity panel has
                given way to the strip it offered, this is the one place on the
                page that says so. A port's line names its datum too, which a
                Canadian page may only do once the curve is on screen. */}
            <p className="mt-3 text-sm text-sw-steel">
              {station.kind === 'tide'
                ? datumLine(station)
                : `Predictions ${provenance(station)}, fetched from DFO by your browser.`}
            </p>
            {more.loading && <p role="status" className="mt-3 text-sm text-sw-steel">Downloading more predictions from the Canadian Hydrographic Service… <button type="button" onClick={more.cancel} className="underline">Cancel</button></p>}
            {more.error && <p role="status" className="mt-3 text-sm text-sw-steel">{more.error} <button type="button" onClick={more.retry} className="underline">Retry</button></p>}
            <div className="print:hidden">
              <StationTiles station={station} readings={curveReadings} moment={reading} initial={selectedAt?.getTime()} />
            </div>
          </div>
        )
      ) : (
        <div className="mt-8 print:hidden">
          <ComputedStrip station={station} now={now} live={live} about={about} refined={layer.refined} moment={moment} reading={reading} initial={selectedAt?.getTime()} />
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
      <FindWater />
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
type Turns = { kind: 'tide'; turns: TideExtreme[] } | { kind: 'current'; events: StationEvent[] }

function turns(station: BundledStation, from: Date, to: Date): Turns {
  return station.kind === 'tide'
    ? { kind: 'tide', turns: tideExtremes(station, from, hoursBetween(from, to)) }
    : { kind: 'current', events: findEvents(station, from, hoursBetween(from, to)) }
}

/** Table rows from a tide's turns or a current's events, whichever source they came from. */
function rowsOf(station: BundledStation, from: Turns) {
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
 * The same day the strip swaps, from the same fetch, joined by the same rule
 * (`seamFor`), so the strip and the table list the same turns: every row
 * inside the hours DFO sent is CHS's, and a computed row stays or goes by
 * `keeps`. A computed row prints its own computed height, unmarked, so the
 * caption's credit stays true; the strip may draw it on the eased curve.
 *
 * The seam comes from DFO's hours alone. The week only chooses which rows to
 * show: a shared moment's week can lie days from the reader's own day, and
 * must not gain rows from outside it.
 */
function refineRows(station: BundledStation, week: Date[], computed: Turns, refined?: Refined) {
  const seam = refined && seamFor(station, refined)
  if (!refined || !seam) return rowsOf(station, computed)
  const shown = (time: Date) => time >= week[0] && time < week[7]
  const ours: Turns = computed.kind === 'tide'
    ? { kind: 'tide', turns: computed.turns.filter((t) => seam.keeps(turnKind(t), t.time)) }
    : { kind: 'current', events: computed.events.filter((e) => seam.keeps(turnKind(e), e.time)) }
  const chs = rowsOf(station, tidyLayer(refined))
    .filter((r) => seam.inside(r.time) && shown(r.time))
    .map((r) => ({ ...r, chs: true }))
  return [...rowsOf(station, ours), ...chs].sort((a, b) => a.time.getTime() - b.time.getTime())
}

/** What `StationPage` hands every strip about the moment: see `moment` there. */
type Moment = {
  now?: number
  selected?: number
  onMove: (time: number) => void
  onNow: (time: number) => void
  onReading: (time: number) => void
}

/**
 * A bundled station's strip: 96 hours behind the station-local start of the
 * day it opens on and 180 ahead, the window the package's own station page
 * loads, computed by `predict.ts`.
 *
 * Where the reader's browser has CHS's day for the station, that day is
 * spliced in over the window it covers, as `refineRows` splices the table,
 * and the line under the strip says whose numbers are whose.
 */
function ComputedStrip({ station, now, live, about, refined, moment, reading, initial }: {
  station: BundledStation
  now: Date
  live: boolean
  /** What the page is about — see `StationPage` — or undefined while it follows now. */
  about?: Date
  refined?: Refined
  moment: Moment
  /** Where the strip reads, and where its server render opened, for the tiles. */
  reading: MomentStore
  initial?: number
}) {
  const tz = station.timezone
  const [anchor, setAnchor] = useState(() => dayStart(about ?? now, tz).getTime())
  const next = stripAnchor(anchor, now.getTime(), dayStart(now, tz).getTime(), about === undefined && live)
  if (next !== anchor) setAnchor(next)
  const computed = useMemo(
    () => computedReadings(station, new Date(anchor - STRIP_BEFORE_HOURS * 3600_000), STRIP_BEFORE_HOURS + STRIP_AFTER_HOURS),
    [station, anchor],
  )
  const readings = useMemo(() => (refined ? spliceReadings(station, computed, refined) : computed), [station, computed, refined])
  const seam = useMemo(() => refined && seamFor(station, refined), [station, refined])
  // The table's week, which the page's moment starts: see `WeekTable`.
  const week = days(about ?? now, tz, 7)
  // One rule: the credit speaks only of what the strip's window shows.
  const view = refined && seam && readings !== computed ? joinInView(seam, computed, readings) : undefined
  const credit = refined && seam && view
    ? refinedCredit(station, {
        ...view,
        today: live && !!view.dfo && dayStart(view.dfo.from, tz).getTime() === dayStart(now, tz).getTime(),
        rows: (refined.kind === 'tide' ? refined.turns : refined.events)
          .some((t) => seam.inside(t.time) && t.time >= week[0] && t.time < week[7]),
        kept: view.kept.map((t) => ({ time: t.time, what: keptName(t.kind) })),
      })
    : undefined
  return (
    <>
      <StationStrip key={anchor} station={station} readings={readings} {...moment} />
      {/* The credit moves with the curve. Until CHS's day arrives the page
          credits its constants under Station facts, as every computed page
          does; once it is on the strip, this says whose numbers are whose,
          for the hours and the day DFO actually covered. */}
      {credit && <p className="mt-3 text-sm text-sw-steel">{credit}</p>}
      <StationTiles station={station} readings={readings} moment={reading} initial={initial} />
    </>
  )
}

/** A computed turn kept inside DFO's hours, named for the credit as the table names it. */
const keptName = (kind: TurnKind) =>
  kind === 'flood' ? 'maximum flood' : kind === 'ebb' ? 'maximum ebb' : kind

/**
 * The station-local midnight a bundled strip's window hangs from.
 *
 * Fixed at the first render, which the server and the hydrating browser
 * share, and kept while the strip can centre the reader's clock. A page
 * following now moves it to the reader's own day once it can't — a page left
 * open, a copy cached long past the build, or Now pressed on a shared moment
 * the window can't reach — and the strip remounts there rather than having
 * its data shifted under it mid-glide.
 *
 * The strip centres nothing closer to an end than half its width, and the
 * widest strip, the page's 720 px column at 18 px an hour, is 40 hours wide.
 */
export function stripAnchor(anchor: number, now: number, today: number, following: boolean): number {
  const reach = (hours: number) => (hours - STRIP_HALF_HOURS) * 3600_000
  const outside = now - anchor > reach(STRIP_AFTER_HOURS) || anchor - now > reach(STRIP_BEFORE_HOURS)
  return following && outside ? today : anchor
}

/** Half the widest strip, in hours: see `stripAnchor`. */
const STRIP_HALF_HOURS = 20

/**
 * Where the strip resting at `time` puts the page: the instant path away from
 * now, the station's own path at it, and the moment the page is then about.
 */
export function restingPlace(station: Station, time: number, clock: number): { path: string; about?: Date } {
  return Math.abs(time - clock) <= NEAR_NOW_MS
    ? { path: station.path }
    : { path: instantPath(station.path, new Date(time), station.timezone), about: new Date(time) }
}

/** Whether DFO's samples reach `time`; Now on a CHS-only page loads the station's own page when they don't. */
export const covers = (samples: { time: Date }[], time: number) =>
  samples.length > 0 && time >= samples[0].time.getTime() && time <= samples[samples.length - 1].time.getTime()

/**
 * Keeps the address bar, and the moment the page is about, on where the strip
 * rests, so a copied URL shares what the reader is looking at and the 7-day
 * table starts on the day the URL names.
 *
 * Every move is debounced until the strip rests, and judged against the clock
 * the strip itself calls now — the page's, once live — so a rest the strip
 * offers no Now pill for keeps the canonical path, and a glide back to now
 * lands there however it got there. A page left resting at now keeps
 * following now as the clock runs on, so its URL goes on meaning now. Now
 * follows the clock at once, so a window that can't reach now moves before
 * the strip tries to.
 */
function useUrlSync(station: Station, setAbout: (about: Date | undefined) => void, now?: number) {
  const clock = useRef(now)
  clock.current = now
  const write = useDebouncedCallback((time: number) => {
    const { path, about } = restingPlace(station, time, clock.current ?? Date.now())
    setAbout(about)
    if (decodeURI(window.location.pathname) !== path) window.history.replaceState(window.history.state, '', path)
  }, URL_DEBOUNCE_MS)
  const onNow = useCallback((time: number) => {
    setAbout(undefined)
    write(time)
  }, [write, setAbout])
  return { onMove: write, onNow }
}

/**
 * Seven days of turns, visible rather than tabbed: this is the page's
 * long-tail content, and text a crawler has to toggle for carries less weight.
 */
function WeekTable({ station, at, refined }: { station: BundledStation; at: Date; refined?: Refined }) {
  const tz = station.timezone
  const week = days(at, tz, 7)
  const computed = useMemo(() => turns(station, week[0], week[7]), [station, week[0].getTime()])
  const rows = useMemo(() => refineRows(station, week, computed, refined), [station, computed, refined])
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
function waitForRequest(signal: AbortSignal, ms: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

function useChsWindows(station: Station, curve: Curve | undefined, setCurve: (curve: Curve) => void, provided: boolean) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const actions = useRef({ move: (_time: number) => {}, cancel: () => {}, retry: () => {} })
  const ready = Boolean(curve)
  useEffect(() => {
    if (!curve || station.source !== 'chs' || provided) return
    const stop = new AbortController()
    let current = curve
    let busy = false
    let active: 'forward' | 'backward' | undefined
    let cancelled = false
    let failed: 'forward' | 'backward' | undefined
    let firstRequest = true
    const queue: ('forward' | 'backward')[] = ['forward', 'backward', 'forward']
    const signalled: typeof fetch = async (url, options) => {
      await waitForRequest(stop.signal, firstRequest ? 10_000 : 2100)
      firstRequest = false
      return fetch(url, { ...options, signal: stop.signal })
    }
    const run = async () => {
      if (busy || cancelled || stop.signal.aborted || !queue.length) return
      busy = true
      const direction = queue.shift()!
      active = direction
      setLoading(true)
      setError(undefined)
      const first = current.samples[0].time.getTime()
      const last = current.samples[current.samples.length - 1].time.getTime()
      const start = new Date(direction === 'forward' ? last : first - 24 * 3600_000)
      try {
        const next: Curve = station.kind === 'tide'
          ? { kind: 'tide', ...(await fetchPortTides(station, start, 24, signalled)) }
          : { kind: 'current', ...(await fetchGateCurrent(station, start, 24, signalled)) }
        if (stop.signal.aborted) return
        current = mergeWindows(current, next)
        setCurve(current)
      } catch (e) {
        if (stop.signal.aborted) return
        failed = direction
        queue.length = 0
        setError(e instanceof Error ? e.message : 'More predictions could not be loaded.')
      } finally {
        busy = false
        active = undefined
        if (!stop.signal.aborted) setLoading(false)
      }
      if (!failed) void run()
    }
    actions.current = {
      move: (time) => {
        if (failed || cancelled || !current.samples.length) return
        const first = current.samples[0].time.getTime()
        const last = current.samples[current.samples.length - 1].time.getTime()
        const direction = time - first < 3 * 3600_000 ? 'backward' : last - time < 3 * 3600_000 ? 'forward' : undefined
        if (direction && direction !== active && !queue.includes(direction)) { queue.unshift(direction); void run() }
      },
      cancel: () => { cancelled = true; queue.length = 0; stop.abort(); setLoading(false) },
      retry: () => { if (failed) { queue.unshift(failed); failed = undefined; void run() } },
    }
    // Leave room in the rolling minute for the initial station and series requests.
    void run()
    return () => stop.abort()
  }, [station, ready, setCurve, provided])
  return { loading, error, move: (time: number) => actions.current.move(time), cancel: () => actions.current.cancel(), retry: () => actions.current.retry() }
}

function ChsGate({
  station,
  at: page,
  settled,
  hours,
  onCurve,
}: {
  station: ChsStation
  /** The page's moment: the shared one, or the reader's clock. */
  at: Date
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
  // Read at fetch time, deliberately NOT a dependency. The clock is a new
  // moment every tick, and a tick is not a reason to ask DFO for another day.
  const at = useRef(page)
  at.current = page

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
    const signalled: typeof fetch = async (url) => {
      await waitForRequest(stop.signal, 500)
      return fetch(url, { signal: stop.signal })
    }
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
      .then(onCurve)
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
 * One request per page view, for the reader's own day. Every other day on the
 * strip stays computed rather than asking DFO again: IWLS documents
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

/** Every station share needs a link home, including web-only gauges. */
function Cta({ station }: { station: Station }) {
  const webOnly = station.kind === 'tide' && WEB_ONLY_TIDE_SLUGS.includes(station.slug)
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
      {!webOnly && <p className="text-sw-steel">{pitch}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {!webOnly && <a
          href={beta ? TESTFLIGHT_BETA : APP_STORE}
          className="rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          {beta ? 'Join the TestFlight beta' : 'Download on the App Store'}
        </a>}
        <a
          href="/"
          className="whitespace-nowrap text-sw-steel underline underline-offset-4 transition hover:text-sw-paper"
        >
          Slackwater
        </a>
      </div>
      {!webOnly && <p className="mt-3 text-sm text-sw-steel">{REQUIREMENT}</p>}
    </section>
  )
}
