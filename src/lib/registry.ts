//
// BUILD-TIME ONLY, like catalogue.ts — it walks the whole station database.
//
// The database owns curated identity: a hand-written name, a real region,
// and aliases, carried as identity-only records beside the provider rows. A
// provider row for the same water carries the provider's own name, which is
// why /currents/boundary-pass read "Turn Point, Boundary Pass" until this
// existed.
import { allStations } from '@slackwater/database'
import { stationRoute } from './routes'
import type { ChsStation, Kind } from './station'

interface Record {
  id: string
  kind: Kind
  name: string
  context?: string
  context_derived?: boolean
  latitude: number
  longitude: number
  timezone: string
  region_code?: string
  source?: { name?: string }
  current?: { derived?: unknown }
}

/** The `source.name` the database gives every curated CHS record. */
const CHS_SOURCE = 'Canadian Hydrographic Service'

/**
 * A curated record is one the database owns rather than mirrors from a
 * provider, and the id shape says which: a provider row is `noaa/…` or
 * `ticon/…`, a curated one is a bare key (`chs-victoria`, `noaa-boundary-pass`).
 * The same rule `isBuildable` in catalogue.ts reads the other way round.
 */
const curatedRecords = (allStations as unknown as Record[]).filter((s) => !s.id.includes('/'))

export interface Curated {
  name: string
  region?: string
}

/**
 * Curated identity for one kind, keyed by SLUG rather than id.
 *
 * Slug is the join key because that is how the database expresses "these two
 * ids are one station": a merged pair holds one route with both ids on it. An
 * id join would miss every one of them.
 */
export function curatedBySlug(kind: Kind): Map<string, Curated> {
  const out = new Map<string, Curated>()
  for (const s of curatedRecords) {
    if (s.kind !== kind) continue
    const slug = stationRoute(kind, s.id)?.slug
    if (!slug) continue
    const region = s.context_derived ? undefined : s.context
    out.set(slug, { name: s.name, ...(region ? { region } : {}) })
  }
  return out
}

/**
 * The Canadian stations of one kind, from identity the database already
 * publishes.
 *
 * Every gate and every live Canadian tide port is a curated record with a
 * name, region, corrected position, timezone and province
 * (slackwater-database#210), and the site publishes all of them. A station here that shares its route with a publishable
 * provider row is folded into that row's page by the catalogue.
 */
export function chsStations(kind: Kind): ChsStation[] {
  const out: ChsStation[] = []
  for (const s of chsRecords(kind)) {
    const station = chsStation(s)
    // A station with no published route is a broken corpus, not one to skip: it
    // means the database's records and its route index disagree about what exists.
    if (!station) throw new Error(`registry: no published route for CHS ${kind} station ${s.id}`)
    out.push(station)
  }
  return out
}

/**
 * Every curated CHS record of one kind, keyed by the slug of the route it
 * shares, whether or not this site publishes it on its own.
 *
 * A record here is the CHS half of a merged pair whenever a provider row with
 * constituents sits on the same route. That page is the provider's, with the
 * curated identity and the browser's CHS layer on top, and it is a page
 * because the provider row is publishable — not because of this map.
 */
export function chsTwins(kind: Kind): Map<string, ChsStation> {
  const out = new Map<string, ChsStation>()
  for (const s of chsRecords(kind)) {
    const station = chsStation(s)
    if (station) out.set(station.slug, station)
  }
  return out
}

const chsRecords = (kind: Kind) =>
  curatedRecords.filter((s) => s.source?.name === CHS_SOURCE && s.kind === kind)

function chsStation(s: Record): ChsStation | undefined {
  const kind = s.kind
  const route = stationRoute(kind, s.id)
  if (!route) return undefined
  const { slug, path } = route
  const region = s.context_derived ? undefined : s.context
  // The province a page competes for ("tides victoria bc") is read rather
  // than guessed from the position; a record with no Canadian code gets
  // none, because an invented one puts a station under the wrong heading.
  const code = String(s.region_code ?? '')
  const state = code.startsWith('CA-') ? code.slice(3) : undefined
  return {
    id: s.id, kind, slug, path, source: 'chs',
    name: s.name,
    ...(region ? { region } : {}),
    // Every CHS station is Canadian by definition of the provider.
    country: 'Canada',
    continent: 'Americas',
    ...(state ? { state } : {}),
    // Carried through so the page knows not to offer a curve it cannot
    // fetch: a derived gate has no CHS current station, and resolving its
    // position would land on real water 47 km away down another inlet.
    ...(s.current?.derived ? { derived: true as const } : {}),
    latitude: s.latitude, longitude: s.longitude,
    timezone: s.timezone,
  }
}
