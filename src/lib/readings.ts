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
import { FEET_PER_METRE } from './format'
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
 * Points in time order, with any whose time or value isn't a finite number
 * left out. DFO's answers arrive in order today; nothing here relies on it,
 * because the seam reads the first and last points as the ends of DFO's hours
 * and one NaN there would carry into every eased height.
 */
function tidy<T extends { time: Date; level: number }>(points: T[]): T[] {
  return points
    .filter((p) => Number.isFinite(p.time.getTime()) && Number.isFinite(p.level))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
}

/** CHS's day with its samples and turns tidied: see `tidy`. */
export function tidyLayer<T extends Published & { start: Date; hours: number }>(layer: T): T {
  return layer.kind === 'tide'
    ? { ...layer, samples: tidy(layer.samples), turns: tidy(layer.turns) }
    : { ...layer, samples: tidy(layer.samples), events: tidy(layer.events) }
}

/**
 * The stretch of time CHS's day actually covers, in ms, `to` exclusive: the
 * window it was asked for, cut to the first and last samples DFO sent. A
 * short answer replaces only the hours it reaches, rather than a whole day of
 * computed water with a line drawn on past its end. A gap inside the answer
 * is still drawn straight across.
 */
export function layerSpan(layer: { start: Date; hours: number; samples: Sample[] }): { from: number; to: number } {
  const samples = tidy(layer.samples)
  const first = samples[0]?.time.getTime() ?? Infinity
  const last = samples.at(-1)?.time.getTime() ?? -Infinity
  return {
    from: Math.max(layer.start.getTime(), first),
    to: Math.min(layer.start.getTime() + layer.hours * 3600_000, last + 1),
  }
}

/** What a turn is, so a computed turn can be matched with CHS's own of the same kind. */
export type TurnKind = 'high' | 'low' | 'slack' | 'flood' | 'ebb' | 'minFlood' | 'minEbb'

/** The kind of a high or low, or of a current event in either the site's or the package's naming. */
export function turnKind(turn: { high: boolean } | { kind: string }): TurnKind {
  if ('high' in turn) return turn.high ? 'high' : 'low'
  return turn.kind === 'maxFlood' ? 'flood' : turn.kind === 'maxEbb' ? 'ebb' : (turn.kind as TurnKind)
}

/*
 * The seam constants below come from one measurement, made on 19 November
 * 2026: DFO's `wlp` (at FIFTEEN_MINUTES) and `wlp-hilo` for every merged tide
 * port, each read through `fetchPortTides` and `fetchRefinement` as the site
 * reads them, for each station-local day from 20 November to 4 December
 * 2026, one spring-neap cycle: 2,955 port-days. For each port-day it took
 * the step between DFO's curve and the computed curve at both ends of DFO's
 * hours, the time from each DFO turn to the nearest computed turn of its
 * kind, and the fast-water marks the ease would make.
 *
 * It is one late-November sample. The rivers' freshet (the Fraser, the St
 * Lawrence) and the perigean springs of other months were not in it,
 * and either could widen the steps or the timing. `node
 * tools/measure-chs-seam.mjs` repeats it for any window, and
 * `catalogue.test.ts` fails when the merged ports it was made on change.
 */

/**
 * How near a CHS turn a computed turn of the same kind must be to count as
 * the same high, low, slack or maximum.
 *
 * In the measurement, the computed twin of a DFO turn lies a median 5
 * minutes from it, within 35 minutes for 95% of turns and 72 minutes for
 * 99%; the few beyond two hours are turns one model has and the other
 * doesn't. Two DFO turns of one kind are never closer than about 2.6 hours,
 * so 75 minutes takes in 99% of twins and stays under half the gap between
 * two real turns. Measured on tide ports, the only kind merged so far; a
 * merged gate's slacks, which a weak reversal can put closer together, would
 * need their own measurement (`catalogue.test.ts` fails if one is merged).
 */
export const SEAM_TWIN_MS = 75 * 60_000

/**
 * How far either side of CHS's day the computed curve is eased onto it.
 *
 * In the measurement the two curves differ at an edge by a median 0.3 ft,
 * 1.5 ft at the 95th percentile and 2.7 ft at the 99th, by datum and by
 * model; a bare step would draw the whole difference across one sample. The
 * ease spreads it under `SEAM_FAST_MPH` (see `easeFor`), and the length is
 * how much room that leaves: over six hours about 3% of the measured
 * port-days had too little room to take their step and could not be joined,
 * over nine 1.5%, over twelve 0.3%, all at the widest-ranging ports, where
 * the water runs fast most of the day. Twelve hours joins all but those.
 */
export const SEAM_RAMP_MS = 12 * 3600_000

/**
 * The rate, in metres an hour, at which the strip marks fast water: the
 * package's `FAST_RATE`.
 *
 * The ease must never make a mark of its own. A plain cosine ease added its
 * slope wherever it fell, and in the measurement that pushed computed water
 * running at 0.53–0.60 m an hour past this line on about 1% of port-days, at
 * up to 0.76 m an hour, mostly in the St Lawrence and the Strait of Georgia.
 * So the ease
 * spends only nine tenths of the room the computed curve leaves under this
 * rate at each moment, and none where it already runs faster: computed water
 * under it stays under it, and fast water stays as fast as computed.
 */
export const SEAM_FAST_MPH = 0.6

/**
 * The ease onto DFO's height at one edge: the fraction of the step `step`
 * (feet) to add to the computed curve at each moment, 1 at the edge and 0
 * `SEAM_RAMP_MS` away, or undefined when that stretch has too little room
 * under `SEAM_FAST_MPH` to take the whole step, and the day is not joined.
 *
 * The fraction grows with the room the computed curve leaves at each moment,
 * so the slope it adds never exceeds nine tenths of that room. It adds most
 * where the water is slack, at the turns, and none where it already runs fast.
 */
function easeFor(station: BundledStation, edge: Date, side: 'before' | 'after', step: number): ((t: number) => number) | undefined {
  if (step === 0) return () => 0
  const from = side === 'before' ? new Date(edge.getTime() - SEAM_RAMP_MS) : edge
  const grid = predictSeries(station, from, SEAM_RAMP_MS / 3600_000, 600)
  if (grid.length < 3) return undefined
  const hours = (a: Sample, b: Sample) => (b.time.getTime() - a.time.getTime()) / 3600_000
  // Room under the line at each sample, in metres an hour, from the curve's own rate.
  const room = grid.map((_, i) => {
    const a = grid[Math.max(0, i - 1)]
    const b = grid[Math.min(grid.length - 1, i + 1)]
    const rate = Math.abs((b.level - a.level) / FEET_PER_METRE / hours(a, b))
    return 0.9 * Math.max(0, SEAM_FAST_MPH - rate)
  })
  // Running room in metres, from the far end of the ramp toward the edge.
  const order = side === 'before' ? grid.map((_, i) => i) : grid.map((_, i) => grid.length - 1 - i)
  const total: number[] = new Array(grid.length).fill(0)
  for (let k = 1; k < order.length; k++) {
    const [i, j] = [order[k - 1], order[k]]
    total[j] = total[i] + ((room[i] + room[j]) / 2) * Math.abs(hours(grid[i], grid[j]))
  }
  const whole = total[side === 'before' ? grid.length - 1 : 0]
  if (whole < Math.abs(step) / FEET_PER_METRE) return undefined
  const t0 = grid[0].time.getTime()
  const dt = grid[1].time.getTime() - t0
  return (t) => {
    const x = (t - t0) / dt
    if (x <= 0) return total[0] / whole
    if (x >= grid.length - 1) return total[grid.length - 1] / whole
    const i = Math.floor(x)
    return (total[i] + (total[i + 1] - total[i]) * (x - i)) / whole
  }
}

/**
 * The largest step at an edge at which CHS's day is joined at all, in feet.
 *
 * In the measurement every merged port but one steps by 3.4 ft at most; Mill
 * Bay steps by six to eight feet on every day, which is not two models
 * disagreeing but a computed curve that does not describe that water. Easing
 * a step like that would draw tide that never ran, and leaving it bare draws
 * a cliff the strip marks as its fastest water. So a day stepping past 3.5 ft
 * at either edge is not joined: the strip and the table stay computed for it,
 * with no CHS rows and no CHS credit. The decision is each day's, so a port
 * whose computed row is corrected joins again on its own.
 */
export const SEAM_STEP_LIMIT_FT = 3.5

/** Where CHS's day meets the computed curve, and what that does to the computed water beside it. */
export interface Seam {
  /** DFO's: inside the hours it sent. */
  inside(time: Date): boolean
  /**
   * Whether a computed turn of this kind at `time` stays beside DFO's.
   *
   * Outside DFO's hours it stays unless DFO lists a twin of its kind within
   * `SEAM_TWIN_MS`: the same high seven minutes apart from two models is one
   * high. Inside them DFO's turns stand in for the computed ones, except
   * within `SEAM_TWIN_MS` of either end with no twin listed: DFO is asked
   * for midnight to midnight, so a computed 00:03 high whose DFO twin fell at
   * 23:57 the day before was never fetched, and dropping it would lose the
   * high from both sources. A lull inside DFO's hours always goes.
   */
  keeps(kind: TurnKind, time: Date): boolean
  /**
   * The strip's height for computed water at `time`: eased onto DFO's at
   * each end of its hours, so the curve meets it without a step. Inside DFO's
   * hours, a kept turn beside the edge keeps its own computed height, the
   * number the table prints and the credit names as computed. Currents are
   * not eased: a shifted speed would move its slacks off zero.
   */
  strip(time: Date, computed: number): number
  /** Which ends were eased: neither for a current, nor at an end with no computed height to meet. */
  eased: { before: boolean; after: boolean }
  /** DFO's first and last samples inside its hours, and whether they span the whole day it was asked for. */
  covered: { from: Date; to: Date; whole: boolean }
}

/**
 * The one rule for joining CHS's day to a station's computed predictions,
 * which the strip (`spliceReadings`) and the 7-day table (`refineRows`) both
 * follow, so the two list the same turns:
 *
 * - Inside the hours DFO sent, everything is CHS's, exactly as published.
 * - A computed turn is kept or dropped by `keeps`, the same in both.
 * - The strip's curve is eased onto DFO's at each end of its hours over
 *   `SEAM_RAMP_MS`, and its computed turns there sit on the eased curve. The
 *   table prints every computed turn at its own computed height, so its
 *   credit stays true; beside the seam the two can differ by the ease.
 *
 * Worked out from DFO's hours alone, never from the week or window on
 * screen: a page resting on tomorrow still meets today's DFO day at
 * midnight. Undefined when DFO sent no samples, or when the day steps past
 * `SEAM_STEP_LIMIT_FT` at either edge and is not joined at all.
 */
export function seamFor(station: BundledStation, raw: Published & { start: Date; hours: number }): Seam | undefined {
  const layer = tidyLayer(raw)
  const span = layerSpan(layer)
  const inside = (time: Date) => time.getTime() >= span.from && time.getTime() < span.to
  const samples = layer.samples.filter((p) => inside(p.time))
  if (!samples.length) return undefined
  const turns = (layer.kind === 'tide' ? layer.turns : layer.events).filter((t) => inside(t.time))
  const first = samples[0]
  const last = samples[samples.length - 1]
  const at = (time: Date) => predictSeries(station, time, 1 / 3600, 1)[0]?.level
  // No computed height to meet, no ease at that end: an unknown difference
  // must not shift the computed water by DFO's whole height above datum.
  const step = (dfo: number, ours: number | undefined) => (ours !== undefined && Number.isFinite(ours) ? dfo - ours : 0)
  const tide = layer.kind === 'tide'
  const [before, after] = tide ? [step(first.level, at(first.time)), step(last.level, at(last.time))] : [0, 0]
  // A day stepping past the cap is not joined: see `SEAM_STEP_LIMIT_FT`.
  if (Math.abs(before) > SEAM_STEP_LIMIT_FT || Math.abs(after) > SEAM_STEP_LIMIT_FT) return undefined
  // Nor one whose step the hours beside it can't take without making
  // fast water of their own: see `easeFor`.
  const easeBefore = easeFor(station, first.time, 'before', before)
  const easeAfter = easeFor(station, last.time, 'after', after)
  if (!easeBefore || !easeAfter) return undefined
  const twin = (kind: TurnKind, time: Date) =>
    turns.some((t) => turnKind(t) === kind && Math.abs(t.time.getTime() - time.getTime()) <= SEAM_TWIN_MS)
  // From the ends of DFO's hours, midnight to midnight, not its first and
  // last samples inside them: DFO's 24:00 sample opens the next day, so the
  // last inside is 23:45, which would stretch the end's window.
  const edge = (time: Date) => time.getTime() - span.from <= SEAM_TWIN_MS || span.to - time.getTime() <= SEAM_TWIN_MS
  return {
    inside,
    eased: { before: before !== 0, after: after !== 0 },
    covered: {
      from: first.time,
      to: last.time,
      whole: span.from === layer.start.getTime() && span.to === layer.start.getTime() + layer.hours * 3600_000,
    },
    // A lull inside DFO's hours never stays, edge or not: DFO publishes none,
    // so there is no twin to have missed, and it would sit under DFO's curve.
    keeps: (kind, time) => {
      if (!inside(time)) return !twin(kind, time)
      return kind !== 'minFlood' && kind !== 'minEbb' && edge(time) && !twin(kind, time)
    },
    strip: (time, computed) => {
      const t = time.getTime()
      // A kept turn inside DFO's hours keeps its own height, even past DFO's
      // last sample at 23:45, where the ease would otherwise begin.
      if (!tide || inside(time)) return computed
      if (t < first.time.getTime()) return computed + before * easeBefore(t)
      if (t > last.time.getTime()) return computed + after * easeAfter(t)
      return computed
    },
  }
}

/**
 * The computed readings with CHS's day in place of everything it covers,
 * joined by `seamFor`'s rule.
 *
 * Kept to the computed window: a shared moment's strip can lie days from the
 * reader's own day, and DFO's day must not stretch it or hang off one end of
 * it. A day whose ease reaches nowhere into the window changes nothing. One
 * inside it replaces the curve and the turns together, even where DFO lists
 * no turn: the computed lulls have no CHS counterpart and must not survive
 * under its curve.
 */
export function spliceReadings(
  station: BundledStation,
  computed: Readings,
  raw: Published & { start: Date; hours: number },
): Readings {
  const layer = tidyLayer(raw)
  if (computed.kind !== layer.kind || !computed.timeline.length) return computed
  const seam = seamFor(station, layer)
  if (!seam) return computed
  const from = computed.timeline[0].time.getTime()
  const to = computed.timeline[computed.timeline.length - 1].time.getTime()
  const span = layerSpan(layer)
  if (span.to + SEAM_RAMP_MS < from || span.from - SEAM_RAMP_MS > to) return computed
  const shown = (p: { time: Date }) => p.time.getTime() >= from && p.time.getTime() <= to
  const published = publishedReadings(layer)
  const ours = <T extends { time: Date }>(items: T[]) => items.filter((p) => !seam.inside(p.time))
  const theirs = <T extends { time: Date }>(items: T[]) => items.filter((p) => seam.inside(p.time) && shown(p))
  const merge = <T extends { time: Date }>(a: T[], b: T[]) => [...a, ...b].sort((x, y) => x.time.getTime() - y.time.getTime())
  const kept = <T extends { time: Date } & ({ high: boolean } | { kind: string })>(items: T[]) =>
    items.filter((t) => seam.keeps(turnKind(t), t.time))
  if (computed.kind === 'tide' && published.kind === 'tide') {
    const eased = <T extends { time: Date; level: number }>(p: T) => ({ ...p, level: seam.strip(p.time, p.level) })
    return {
      kind: 'tide',
      timeline: merge(ours(computed.timeline).map(eased), theirs(published.timeline)),
      extremes: merge(kept(computed.extremes).map(eased), theirs(published.extremes)),
    }
  }
  if (computed.kind === 'current' && published.kind === 'current') {
    return {
      kind: 'current',
      timeline: merge(ours(computed.timeline), theirs(published.timeline)),
      events: merge(kept(computed.events), theirs(published.events)),
    }
  }
  return computed
}

/** What of CHS's joined day the strip's window actually shows: the facts the credit under it (`refinedCredit`) is worded from. */
export interface JoinInView {
  /** DFO's first and last points on the strip, and whether they are its whole day; undefined when none is in view. */
  dfo?: { from: Date; to: Date; whole: boolean }
  /** The day DFO covered, for the wording when only the ease beside it is in view. */
  day: Date
  /** Computed turns kept inside DFO's hours (`Seam.keeps`) that are in view. */
  kept: { time: Date; kind: TurnKind }[]
  /** Which of the eased stretches beside DFO's day are in view. */
  eased: { before: boolean; after: boolean }
}

/**
 * The one rule for the strip's credit: credit CHS only for DFO's points
 * inside the strip's window, and name only the kept turns and eased stretches
 * that are inside it too. `readings` is `spliceReadings`' result for the
 * window `computed` covers. Undefined when the window shows neither a DFO
 * point nor an eased stretch.
 */
export function joinInView(seam: Seam, computed: Readings, readings: Readings): JoinInView | undefined {
  if (!computed.timeline.length) return undefined
  const from = computed.timeline[0].time.getTime()
  const to = computed.timeline[computed.timeline.length - 1].time.getTime()
  const inWindow = (t: Date) => t.getTime() >= from && t.getTime() <= to
  const theirs = readings.timeline.filter((p) => seam.inside(p.time) && inWindow(p.time))
  const { covered } = seam
  const dfo = theirs.length
    ? {
        from: theirs[0].time,
        to: theirs[theirs.length - 1].time,
        whole: covered.whole && +theirs[0].time === +covered.from && +theirs[theirs.length - 1].time === +covered.to,
      }
    : undefined
  const turns: { time: Date; kind: TurnKind }[] = (computed.kind === 'tide' ? computed.extremes : computed.events)
    .map((t) => ({ time: t.time, kind: turnKind(t) }))
  const kept = turns.filter((t) => seam.inside(t.time) && seam.keeps(t.kind, t.time) && inWindow(t.time))
  // Each eased stretch, [start, end] in ms, against the window.
  const overlaps = (a: number, b: number) => a <= to && b >= from
  const eased = {
    before: seam.eased.before && overlaps(covered.from.getTime() - SEAM_RAMP_MS, covered.from.getTime() - 1),
    after: seam.eased.after && overlaps(covered.to.getTime() + 1, covered.to.getTime() + SEAM_RAMP_MS),
  }
  if (!dfo && !eased.before && !eased.after) return undefined
  return { dfo, day: covered.from, kept, eased }
}
