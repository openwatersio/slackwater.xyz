import type { Station } from './station'

const EARTH_NM = 3440.065 // mean Earth radius in nautical miles
const rad = (d: number) => (d * Math.PI) / 180

/** Anything with a position. Widened from `Station` so `iwls.ts` can resolve a
 *  provider record against a curated one without a second great-circle. */
export interface Positioned {
  latitude: number
  longitude: number
}

/** Great-circle distance in nautical miles — the unit the audience navigates in. */
export function distanceNm(a: Positioned, b: Positioned): number {
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
 */
export function nearby(station: Station, all: Station[], k = 6): Station[] {
  // Top-k by insertion rather than sorting every candidate: this runs once per
  // station while building the whole neighbour map, so the difference between
  // O(n) and O(n log n) per station is real at 3,607 stations.
  const best: { s: Station; d: number }[] = []
  for (const s of all) {
    if (s.kind !== station.kind || s.id === station.id) continue
    const d = distanceNm(station, s)
    if (best.length === k && d >= best[best.length - 1].d) continue
    let i = best.length
    while (i > 0 && best[i - 1].d > d) i--
    best.splice(i, 0, { s, d })
    if (best.length > k) best.pop()
  }
  return best.map((b) => b.s)
}

/**
 * Every station's neighbours, computed in one pass.
 *
 * Built once and reused, NOT recomputed per page. Doing it per render spread
 * the whole catalogue into a fresh array and ranked it again for each of the
 * 3,607 prerendered pages, which pushed page renders past three seconds and
 * broke the prerender's Worker connections outright on CI.
 *
 * ponytail: still O(n^2) distance calculations, ~13M for the current corpus,
 * which takes about a second once. If the corpus grows an order of magnitude,
 * bucket by whole degrees and compare only neighbouring cells.
 */
export function neighbourMap(all: Station[], k = 6): Map<string, Station[]> {
  const map = new Map<string, Station[]>()
  for (const s of all) map.set(s.id, nearby(s, all, k))
  return map
}
