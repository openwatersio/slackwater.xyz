import station from '../data/hero-station.json'
import { predictSeries as predict, findEvents as events } from './predict'
import type { EventKind } from './predict'
import type { Station } from './station'

export type { EventKind }

/** The published shape: signed knots along the major axis. Unchanged. */
export interface Sample {
  time: Date
  knots: number
}

export interface CurrentEvent {
  kind: EventKind
  time: Date
  knots: number
}

export const HERO_STATION: Station = {
  id: station.id, kind: 'current', slug: 'deception-pass', name: station.name,
  latitude: station.latitude, longitude: station.longitude,
  timezone: 'America/Los_Angeles',
  constituents: station.constituents, offset: station.offset,
  floodDirection: station.floodDirection, ebbDirection: station.ebbDirection,
}

export function predictSeries(start: Date, hours: number, fidelitySeconds = 600): Sample[] {
  return predict(HERO_STATION, start, hours, fidelitySeconds).map((s) => ({
    time: s.time,
    knots: s.level,
  }))
}

export function findEvents(start: Date, hours: number): CurrentEvent[] {
  return events(HERO_STATION, start, hours).map((e) => ({
    kind: e.kind,
    time: e.time,
    knots: e.level,
  }))
}

/** The next event at or after `now` — what the hero actually announces. */
export function nextEvent(evts: CurrentEvent[], now: Date): CurrentEvent | undefined {
  return evts.find((e) => e.time.getTime() >= now.getTime())
}
