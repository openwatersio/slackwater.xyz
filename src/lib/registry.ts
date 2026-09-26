//
// BUILD-TIME ONLY, like catalogue.ts — it walks the whole station database.
//
// The database owns curated identity: a hand-written name, a real region,
// and aliases, carried as identity-only records beside the provider rows. A
// provider row for the same water carries the provider's own name, which is
// why /currents/boundary-pass read "Turn Point, Boundary Pass" until this
// existed.
import { allStations } from '@slackwater/database'
import { routeSlug } from './routes'
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

/** Every id the database curates — the curated half of a merged pair. */
export const REGISTRY_IDS: ReadonlySet<string> = new Set(curatedRecords.map((s) => s.id))

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
    const slug = routeSlug(kind, s.id)
    if (!slug) continue
    const region = s.context_derived ? undefined : s.context
    out.set(slug, { name: s.name, ...(region ? { region } : {}) })
  }
  return out
}

/**
 * Deferred by owner decision, and excluded by name because the database
 * publishes it like any other gate — without this rule it would become a page
 * as a side effect of a data source. slackwater-ios excludes it fully as a
 * hazard call: violent rapids, "wrong water under a trusted name". Whether
 * official DFO predictions change that answer is an open question, not one to
 * settle by deleting this line.
 */
const EXCLUDED = new Set(['chs-arran-rapids'])

/**
 * The Canadian stations of one kind, from identity the database already
 * publishes.
 *
 * All 24 gates and ten of the tide ports are curated records with a name,
 * region, corrected position, timezone and province. The other 1,048 CHS tide
 * ports have identity nowhere published — that is the rest of #17 and needs
 * an operator run against IWLS, not a change here.
 */
export function chsStations(kind: Kind): ChsStation[] {
  const out: ChsStation[] = []
  for (const s of curatedRecords) {
    if (s.source?.name !== CHS_SOURCE || s.kind !== kind) continue
    if (EXCLUDED.has(s.id)) continue
    const slug = routeSlug(kind, s.id)
    // A station with no published slug is a broken corpus, not one to skip: it
    // means the database's records and its route index disagree about what exists.
    if (!slug) throw new Error(`registry: no published slug for CHS ${kind} station ${s.id}`)
    const region = s.context_derived ? undefined : s.context
    // The province a page competes for ("tides victoria bc") is read rather
    // than guessed from the position; a record with no Canadian code gets
    // none, because an invented one puts a station under the wrong heading.
    const code = String(s.region_code ?? '')
    const state = code.startsWith('CA-') ? code.slice(3) : undefined
    out.push({
      id: s.id, kind, slug, source: 'chs',
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
    })
  }
  return out
}
