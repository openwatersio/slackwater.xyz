import type { Station } from './station'

const EARTH_NM = 3440.065 // mean Earth radius in nautical miles
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in nautical miles — the unit the audience navigates in. */
export function distanceNm(a: Station, b: Station): number {
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return EARTH_NM * 2 * Math.asin(Math.sqrt(h))
}

/**
 * The `k` nearest stations of the same kind, nearest first.
 *
 * Same kind only: a tide station is not an answer to "what else is near this
 * current", and mixing them would put a height page behind a link a reader
 * followed looking for a rate.
 *
 * ponytail: linear scan, ~3k distance calculations for one station. Called once
 * per page render, which is fast enough that a spatial index would be cost
 * without a benefit. If this ever runs per-request in a hot loop, bucket by
 * whole degrees first.
 */
export function nearby(station: Station, all: Station[], k = 6): Station[] {
  return all
    .filter((s) => s.kind === station.kind && s.id !== station.id)
    .map((s) => ({ s, d: distanceNm(station, s) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, k)
    .map((x) => x.s)
}
