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
