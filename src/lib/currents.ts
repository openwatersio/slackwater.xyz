import { createTidePredictor } from '@neaps/tide-predictor'
import station from '../data/hero-station.json'

/**
 * Signed current velocity for the hero station, computed in the browser from
 * harmonic constituents — the same maths the app does, with no network.
 *
 * The app runs slackwater-engine (Swift); this is @neaps/tide-predictor, which
 * that engine is validated against to floating-point agreement. Same numbers,
 * different language.
 *
 * ponytail: one station, drawn and labelled. No search, no favourites, no
 * picker. The hero is a proof, not a tool — the moment it wants a second
 * station it has become the web client, which is a different product.
 */

export interface Sample {
  time: Date
  /** Signed knots along the major axis: + floods, − ebbs. */
  knots: number
}

export type EventKind = 'slack' | 'flood' | 'ebb'

export interface CurrentEvent {
  kind: EventKind
  time: Date
  /** Signed for flood/ebb, exactly 0 for slack. */
  knots: number
}

export const HERO_STATION = {
  id: station.id,
  name: station.name,
  latitude: station.latitude,
  longitude: station.longitude,
  floodDirection: station.floodDirection,
  ebbDirection: station.ebbDirection,
}

const predictor = createTidePredictor(station.constituents, { offset: station.offset })

/**
 * The curve, for drawing.
 *
 * GOTCHA: `getWaterLevelAtTime` snaps to a ~10-minute grid, so sampling it in a
 * loop returns a staircase — five identical values, then a step. Scanning that
 * for turning points invents an "extreme" at every plateau edge. Use the
 * library's own timeline, and its own extremes below.
 */
export function predictSeries(start: Date, hours: number, fidelitySeconds = 600): Sample[] {
  const end = new Date(start.getTime() + hours * 3600_000)
  return predictor
    .getTimelinePrediction({ start, end, timeFidelity: fidelitySeconds })
    .map((p) => ({ time: new Date(p.time), knots: p.level }))
}

/**
 * Slack, max flood and max ebb, in time order.
 *
 * Extremes come from the predictor analytically rather than from scanning.
 * A "high" that never reaches positive velocity (or a "low" that never goes
 * negative) is a weakest-ebb/flood wiggle mid-phase, not a turn — dropped,
 * because labelling it a max would misdescribe the structure of the day. This
 * matches slackwater-web's noaaCurrentState so the two agree.
 */
export function findEvents(start: Date, hours: number): CurrentEvent[] {
  const end = new Date(start.getTime() + hours * 3600_000)

  const extremes: CurrentEvent[] = predictor
    .getExtremesPrediction({ start, end })
    .filter((e: { high: boolean; level: number }) => (e.high ? e.level > 0 : e.level < 0))
    .map((e: { high: boolean; level: number; time: number | Date }) => ({
      kind: (e.high ? 'flood' : 'ebb') as EventKind,
      time: new Date(e.time),
      knots: e.level,
    }))

  // Slack: interpolate the sign change between timeline samples. At 600s
  // sampling that lands the crossing within seconds for a real station.
  const timeline = predictSeries(start, hours)
  const slacks: CurrentEvent[] = []
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1]
    const b = timeline[i]
    if (a.knots === 0 || a.knots > 0 === b.knots > 0) continue
    const frac = a.knots / (a.knots - b.knots)
    slacks.push({
      kind: 'slack',
      time: new Date(a.time.getTime() + frac * (b.time.getTime() - a.time.getTime())),
      knots: 0,
    })
  }

  return [...extremes, ...slacks].sort((x, y) => x.time.getTime() - y.time.getTime())
}

/** The next event at or after `now` — what the hero actually announces. */
export function nextEvent(events: CurrentEvent[], now: Date): CurrentEvent | undefined {
  return events.find((e) => e.time.getTime() >= now.getTime())
}
