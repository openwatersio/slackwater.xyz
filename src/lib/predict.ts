import { createTidePredictor } from '@neaps/tide-predictor'
import type { Station } from './station'

export interface Sample {
  time: Date
  /** Signed knots for a current, height for a tide. */
  level: number
}

export type EventKind = 'slack' | 'flood' | 'ebb'

export interface StationEvent {
  kind: EventKind
  time: Date
  /** Signed for flood/ebb, exactly 0 for slack. */
  level: number
}

/**
 * Predictors are built per station and cached by id.
 *
 * The previous shape bound one predictor to one bundled station at module
 * scope, which is why every export here now takes a station: a page for 3,607
 * stations cannot share one. The cache keeps a hot station cheap without making
 * the module stateful in a way that leaks across stations - the key is the id,
 * so two stations can never collide.
 */
const predictors = new Map<string, ReturnType<typeof createTidePredictor>>()

function predictorFor(station: Station) {
  // Keyed on id + offset, not id alone: a real station's id never carries two
  // offsets, but keying on id alone would let a stale offset survive a cache
  // hit if one ever did.
  const key = `${station.id}|${station.offset ?? 0}`
  const cached = predictors.get(key)
  if (cached) return cached
  const made = createTidePredictor(station.constituents, { offset: station.offset ?? 0 })
  predictors.set(key, made)
  return made
}

/**
 * The curve, for drawing.
 *
 * GOTCHA carried over from the single-station version: `getWaterLevelAtTime`
 * snaps to a ~10-minute grid, so sampling it in a loop returns a staircase and
 * scanning that for turning points invents an extreme at every plateau edge.
 * Use the library's own timeline.
 */
export function predictSeries(
  station: Station,
  start: Date,
  hours: number,
  fidelitySeconds = 600,
): Sample[] {
  const end = new Date(start.getTime() + hours * 3600_000)
  return predictorFor(station)
    .getTimelinePrediction({ start, end, timeFidelity: fidelitySeconds })
    .map((p) => ({ time: new Date(p.time), level: p.level }))
}

/**
 * Slack, max flood and max ebb, in time order.
 *
 * This is `currents.ts`'s existing algorithm with the station passed in. Do NOT
 * simplify it to `getExtremesPrediction` alone — two behaviours here are load
 * bearing and neither is visible in the predictor's API:
 *
 * 1. `getExtremesPrediction` returns NO slack events. Slack is interpolated
 *    below from the sign change between timeline samples.
 * 2. A "high" that never reaches positive velocity (or a "low" that never goes
 *    negative) is a weakest-ebb/flood wiggle mid-phase, not a turn. Labelling it
 *    a max would misdescribe the day, and this filter is what keeps the site
 *    agreeing with slackwater-web's noaaCurrentState.
 */
export function findEvents(station: Station, start: Date, hours: number): StationEvent[] {
  const end = new Date(start.getTime() + hours * 3600_000)

  const extremes: StationEvent[] = predictorFor(station)
    .getExtremesPrediction({ start, end })
    .filter((e: { high: boolean; level: number }) => (e.high ? e.level > 0 : e.level < 0))
    .map((e: { high: boolean; level: number; time: number | Date }) => ({
      kind: (e.high ? 'flood' : 'ebb') as EventKind,
      time: new Date(e.time),
      level: e.level,
    }))

  // Slack: interpolate the sign change between timeline samples. At 600s
  // sampling that lands the crossing within seconds for a real station.
  const timeline = predictSeries(station, start, hours)
  const slacks: StationEvent[] = []
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1]
    const b = timeline[i]
    if (a.level === 0 || a.level > 0 === b.level > 0) continue
    const frac = a.level / (a.level - b.level)
    slacks.push({
      kind: 'slack',
      time: new Date(a.time.getTime() + frac * (b.time.getTime() - a.time.getTime())),
      level: 0,
    })
  }

  return [...extremes, ...slacks].sort((x, y) => x.time.getTime() - y.time.getTime())
}

/** The next event at or after `now`, or undefined past the window. */
export function nextEvent(events: StationEvent[], now: Date): StationEvent | undefined {
  return events.find((e) => e.time.getTime() >= now.getTime())
}

export interface SlackWindow {
  start: Date
  end: Date
}

/**
 * The speed below which the water counts as slack, in knots.
 *
 * The app makes this a per-boat setting (`slackThresholdKn`, range 0.1…10);
 * the web has no settings, so it ships one value for everyone. THREE marks
 * derive from it — the band's height, the length of the inked run, and the
 * baseline the speed fill starts from — so it is the single number that says
 * what this chart considers workable water, and they cannot drift apart.
 *
 * NOTE: the app's own default is still `defaultSlackThresholdKn = 0.5`
 * (slackwater-ios, SlackWindow.swift). Until that moves, a reader comparing
 * the two sees different windows for the same station.
 */
export const SLACK_KNOTS = 1.5

/**
 * The runs of time the water is transitable, as opposed to the instant it
 * reverses.
 *
 * Endpoints are the interpolated `±threshold` crossings, not the nearest
 * sample: at a fast gate a 10-minute sample lands a long way from the edge.
 *
 * A run only counts if the velocity changes sign inside it. A lull that dips
 * under the threshold and then builds back the way it came is weak water, not
 * slack, and drawing it green would promise a transit that never opens. This
 * is what keeps two windows separated by a sub-threshold blip as one run.
 */
export function slackWindows(
  station: Station,
  start: Date,
  hours: number,
  threshold = SLACK_KNOTS,
): SlackWindow[] {
  const timeline = predictSeries(station, start, hours)
  // Signed distance out of the band — negative inside, zero at the edge. The
  // crossing is interpolated on it the same way findEvents interpolates slack.
  const out = (s: Sample) => Math.abs(s.level) - threshold
  const cross = (a: Sample, b: Sample) =>
    new Date(a.time.getTime() + (out(a) / (out(a) - out(b))) * (b.time.getTime() - a.time.getTime()))

  const windows: SlackWindow[] = []
  let from: Date | undefined = out(timeline[0]) <= 0 ? timeline[0].time : undefined
  let turned = false
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1]
    const b = timeline[i]
    const inA = out(a) <= 0
    const inB = out(b) <= 0
    if (!inA && inB) {
      from = cross(a, b)
      turned = false
    }
    // Checked on the entry and exit steps too, not just the ones wholly inside:
    // at a violent gate the reversal and the band edge land in one sample.
    if ((inA || inB) && a.level > 0 !== b.level > 0) turned = true
    if (inA && !inB) {
      if (from && turned) windows.push({ start: from, end: cross(a, b) })
      from = undefined
      turned = false
    }
  }
  // A window open at the frame edge is real water; it just has no visible end.
  if (from && turned) windows.push({ start: from, end: timeline[timeline.length - 1].time })
  return windows
}
