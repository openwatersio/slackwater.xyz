/**
 * Predictions in the shapes `@slackwater/react`'s strips and data source
 * take: the site's own computed curve, CHS's published day, and the two
 * spliced together.
 *
 * One mapping for every reader. The station pages, the development preview's
 * data source and its CHS panel all name a maximum, a lull and a high the same
 * way, so a fix to one cannot leave the others describing the water
 * differently.
 */
import type { CurrentEvent, CurrentTimelineEntry, Extreme, TimelineEntry } from '@slackwater/react'
import { findEvents, findLulls, predictSeries, tideExtremes, type Sample, type StationEvent, type TideExtreme } from './predict'
import type { BundledStation } from './station'

export type TideReadings = { kind: 'tide'; timeline: TimelineEntry[]; extremes: Extreme[] }
export type CurrentReadings = { kind: 'current'; timeline: CurrentTimelineEntry[]; events: CurrentEvent[] }
export type Readings = TideReadings | CurrentReadings

/**
 * One Canadian day, as DFO published it. A port carries its published highs
 * and lows, a gate its slacks and maxima; neither is derived from the
 * fifteen-minute samples, because DFO states both outright.
 */
export type Published =
  | { kind: 'tide'; samples: Sample[]; turns: TideExtreme[] }
  | { kind: 'current'; samples: Sample[]; events: StationEvent[] }

/** A high or low as the strip labels it. */
export const extreme = (e: TideExtreme): Extreme => ({ ...e, low: !e.high, label: e.high ? 'High' : 'Low' })

/** The set a flood or ebb event runs toward, when the station publishes one; never on a slack. */
const toward = (direction?: number) => (direction === undefined ? {} : { direction })

/** A slack or a maximum as the strip names it. */
export function currentEvent(e: StationEvent, direction?: number): CurrentEvent {
  const kind = e.kind === 'slack' ? 'slack' : e.kind === 'flood' ? 'maxFlood' : 'maxEbb'
  return { time: e.time, speed: e.level, kind, ...(kind === 'slack' ? {} : toward(direction)) }
}

/**
 * A computed current's slacks, maxima and lulls, in time order.
 *
 * The lulls are the strip's "Minimum flood" and "Minimum ebb": weak water
 * that builds back the way it came, which the 7-day table leaves out.
 */
export function currentEvents(station: BundledStation, start: Date, hours: number): CurrentEvent[] {
  return [
    ...findEvents(station, start, hours).map((e) =>
      currentEvent(e, e.kind === 'flood' ? station.floodDirection : station.ebbDirection),
    ),
    ...findLulls(station, start, hours).map((e) => ({
      time: e.time,
      speed: e.level,
      kind: e.kind,
      ...toward(e.kind === 'minFlood' ? station.floodDirection : station.ebbDirection),
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime())
}

/**
 * A computed current's signed speeds. Drawn through its lulls: a subordinate
 * curve threaded only through slacks and maxima would cut under the lulls the
 * strip labels.
 */
export function currentTimeline(station: BundledStation, start: Date, hours: number): CurrentTimelineEntry[] {
  return predictSeries(station, start, hours, 600, { lulls: true }).map((p) => ({ time: p.time, speed: p.level }))
}

/** A bundled station's curve and turns for the window, from `predict.ts`. */
export function computedReadings(station: BundledStation, start: Date, hours: number): Readings {
  return station.kind === 'tide'
    ? {
        kind: 'tide',
        timeline: predictSeries(station, start, hours).map((p) => ({ time: p.time, level: p.level })),
        extremes: tideExtremes(station, start, hours).map(extreme),
      }
    : { kind: 'current', timeline: currentTimeline(station, start, hours), events: currentEvents(station, start, hours) }
}

/**
 * CHS's day as the strip takes it. A gate's samples keep DFO's published
 * magnitude and Set beside the signed value the curve draws.
 */
export function publishedReadings(day: Published): Readings {
  return day.kind === 'tide'
    ? { kind: 'tide', timeline: day.samples.map((p) => ({ time: p.time, level: p.level })), extremes: day.turns.map(extreme) }
    : {
        kind: 'current',
        timeline: day.samples.map((p) => ({ time: p.time, speed: p.level, magnitude: p.magnitude, direction: p.direction })),
        events: day.events.map((e) => currentEvent(e)),
      }
}

/**
 * The stretch of time CHS's day actually covers, in ms, `to` exclusive: the
 * window it was asked for, cut to the first and last samples DFO sent. A
 * short answer replaces only the hours it reaches, rather than a whole day of
 * computed water with a line drawn on past its end. A gap inside the answer
 * is still drawn straight across.
 */
export function layerSpan(layer: { start: Date; hours: number; samples: Sample[] }): { from: number; to: number } {
  const first = layer.samples[0]?.time.getTime() ?? Infinity
  const last = layer.samples.at(-1)?.time.getTime() ?? -Infinity
  return {
    from: Math.max(layer.start.getTime(), first),
    to: Math.min(layer.start.getTime() + layer.hours * 3600_000, last + 1),
  }
}

/**
 * The computed readings with CHS's day in place of everything it covers.
 *
 * The same rule `refineRows` applies to the 7-day table, from the same fetch,
 * so the strip and the table never disagree: every sample and turn inside
 * [start, start + hours) is CHS's, and every one outside is computed. Mixing
 * the two inside the window would interleave two models' turns minutes apart.
 */
export function spliceReadings(computed: Readings, layer: Published & { start: Date; hours: number }): Readings {
  if (computed.kind !== layer.kind || !computed.timeline.length) return computed
  // Clipped to the computed window as well as to DFO's: a shared moment's
  // strip can lie days from the reader's own day, and DFO's day must not
  // stretch it or hang off one end of it.
  const span = layerSpan(layer)
  const from = Math.max(span.from, computed.timeline[0].time.getTime())
  const to = Math.min(span.to, computed.timeline.at(-1)!.time.getTime())
  const inside = (p: { time: Date }) => p.time.getTime() >= from && p.time.getTime() < to
  const published = publishedReadings(layer)
  // A day wholly outside the window changes nothing. One inside it replaces
  // the curve and the turns together, even where DFO lists no turn: the
  // computed lulls have no CHS counterpart and must not survive under its curve.
  if (!published.timeline.some(inside)) return computed
  const merge = <T extends { time: Date }>(ours: T[], theirs: T[]) =>
    [...ours.filter((p) => !inside(p)), ...theirs.filter(inside)].sort((a, b) => a.time.getTime() - b.time.getTime())
  return computed.kind === 'tide' && published.kind === 'tide'
    ? { kind: 'tide', timeline: merge(computed.timeline, published.timeline), extremes: merge(computed.extremes, published.extremes) }
    : computed.kind === 'current' && published.kind === 'current'
      ? { kind: 'current', timeline: merge(computed.timeline, published.timeline), events: merge(computed.events, published.events) }
      : computed
}
