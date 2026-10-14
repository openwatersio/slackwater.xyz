import { dayStart } from './format'
import { distanceNm } from './nearby'
import { findEvents, predictSeries, slackWindows, SLACK_KNOTS, tideExtremes } from './predict'
import type { BundledStation } from './station'

/**
 * The numbers behind `/learn/slack-water/`, computed from the site's own
 * predictions rather than written into the prose.
 *
 * Everything is epoch milliseconds and plain numbers so it crosses the server
 * function boundary unchanged; the page ships these few hundred values, never
 * a station's constituents.
 */

/** How far ahead every statistic on the page looks. */
export const GUIDE_DAYS = 14

const HOUR = 3600_000
const MINUTE = 60_000

export interface GuideStation {
  name: string
  path: string
}

export interface Comparison {
  current: GuideStation
  tide: GuideStation
  timezone: string
  /** Great-circle distance between the two stations, nautical miles. */
  distanceNm: number
  /** One station-local day, chosen to show a slack well away from high or low water. */
  day: {
    start: number
    end: number
    /** [time, signed knots] every 10 minutes. */
    current: [number, number][]
    /** [time, feet above chart datum] every 10 minutes. */
    tide: [number, number][]
    slacks: number[]
    windows: { start: number; end: number }[]
    extremes: { time: number; level: number; high: boolean }[]
    /** The day's slack furthest from its nearest high or low, and that extreme. */
    callout: { slack: number; extreme: number; high: boolean }
  }
  /** Every slack in the next `GUIDE_DAYS`, against its nearest high or low. */
  fortnight: {
    slacks: number
    within30: number
    overHour: number
    medianMinutes: number
    maxMinutes: number
  }
}

export interface SlackRun {
  start: number
  minutes: number
  /** The strongest speed on either side of the run, knots. */
  flankKnots: number
}

export interface DurationRow extends GuideStation {
  peakKnots: number
  windows: number
  medianMinutes: number
  shortest: SlackRun
  longest: SlackRun
}

const nearest = <T extends { time: Date }>(items: T[], at: Date) =>
  items.reduce((a, b) => (Math.abs(+b.time - +at) < Math.abs(+a.time - +at) ? b : a))

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Slack timing at a pass against the tide at a gauge beside it.
 *
 * The tide's extremes are searched over a padded span, so a slack at the edge
 * of the fortnight is matched with the extreme past that edge rather than the
 * nearest one inside it.
 */
export function compareSlackToTide(current: BundledStation, tide: BundledStation, now: Date): Comparison {
  const tz = current.timezone
  const from = dayStart(now, tz)
  const span = GUIDE_DAYS * 24
  const extremes = tideExtremes(tide, new Date(+from - 12 * HOUR), span + 24)
  const slacks = findEvents(current, from, span).filter((e) => e.kind === 'slack')
  const offsets = slacks.map((s) => {
    const e = nearest(extremes, s.time)
    return { slack: s.time, extreme: e, minutes: Math.abs(+s.time - +e.time) / MINUTE }
  })
  const minutes = offsets.map((o) => o.minutes)

  // The first day holding a slack an hour or more from high or low water. In a
  // pass like this one that is nearly always the first day; the fallback keeps
  // the page whole if it is not.
  const late = offsets.find((o) => o.minutes >= 60) ?? offsets.reduce((a, b) => (b.minutes > a.minutes ? b : a))
  const start = dayStart(late.slack, tz)
  const end = dayStart(late.slack, tz, 1)
  const hours = (+end - +start) / HOUR
  const series = predictSeries(current, start, hours)
  const dayOffsets = offsets.filter((o) => o.slack >= start && o.slack < end)
  const callout = dayOffsets.reduce((a, b) => (b.minutes > a.minutes ? b : a))

  return {
    current: { name: current.name, path: current.path },
    tide: { name: tide.name, path: tide.path },
    timezone: tz,
    distanceNm: distanceNm(current, tide),
    day: {
      start: +start,
      end: +end,
      current: series.map((s) => [+s.time, round(s.level)]),
      tide: predictSeries(tide, start, hours).map((s) => [+s.time, round(s.level)]),
      slacks: dayOffsets.map((o) => +o.slack),
      windows: slackWindows(series).map((w) => ({ start: +w.start, end: +w.end })),
      extremes: extremes
        .filter((e) => e.time >= start && e.time <= end)
        .map((e) => ({ time: +e.time, level: round(e.level), high: e.high })),
      callout: { slack: +callout.slack, extreme: +callout.extreme.time, high: callout.extreme.high },
    },
    fortnight: {
      slacks: offsets.length,
      within30: minutes.filter((m) => m <= 30).length,
      overHour: minutes.filter((m) => m >= 60).length,
      medianMinutes: Math.round(median(minutes)),
      maxMinutes: Math.round(Math.max(...minutes)),
    },
  }
}

/**
 * How long each station stays under the site's slack band over the next
 * `GUIDE_DAYS`.
 *
 * The series is padded past both ends and a run that touches the padded edge
 * is dropped: `slackWindows` clamps a run still open at the frame edge, and a
 * clamped run would read as a short slack that never happened.
 */
export function slackDurations(station: BundledStation, now: Date): DurationRow {
  const from = dayStart(now, station.timezone)
  const to = new Date(+from + GUIDE_DAYS * 24 * HOUR)
  const pad = 12 * HOUR
  const series = predictSeries(station, new Date(+from - pad), GUIDE_DAYS * 24 + 24, 300)
  const first = +series[0].time
  const last = +series[series.length - 1].time
  const runs = slackWindows(series)
    .filter((w) => +w.start > first && +w.end < last && w.start >= from && w.start < to)
    .map((w): SlackRun => {
      // The flanks are the peaks the water slows from and builds to: the
      // strongest speed in the six hours either side of the run.
      const flank = series
        .filter((s) => +s.time >= +w.start - 6 * HOUR && +s.time <= +w.end + 6 * HOUR)
        .reduce((m, s) => Math.max(m, Math.abs(s.level)), 0)
      return { start: +w.start, minutes: Math.round((+w.end - +w.start) / MINUTE), flankKnots: round(flank, 1) }
    })
  const inFortnight = series.filter((s) => s.time >= from && s.time < to)
  return {
    name: station.name,
    path: station.path,
    peakKnots: round(Math.max(...inFortnight.map((s) => Math.abs(s.level))), 1),
    windows: runs.length,
    medianMinutes: median(runs.map((r) => r.minutes)),
    shortest: runs.reduce((a, b) => (b.minutes < a.minutes ? b : a)),
    longest: runs.reduce((a, b) => (b.minutes > a.minutes ? b : a)),
  }
}

export interface SlackGuide {
  /** The moment the guide was computed from. */
  now: number
  slackKnots: number
  comparison: Comparison
  durations: DurationRow[]
}

export function slackGuide(
  { current, tide, durations }: { current: BundledStation; tide: BundledStation; durations: BundledStation[] },
  now: Date,
): SlackGuide {
  return {
    now: +now,
    slackKnots: SLACK_KNOTS,
    comparison: compareSlackToTide(current, tide, now),
    durations: durations.map((s) => slackDurations(s, now)),
  }
}

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places
