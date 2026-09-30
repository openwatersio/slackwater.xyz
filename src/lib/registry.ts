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
    const slug = stationRoute(kind, s.id)?.slug
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
 * The Canadian tide ports this site publishes.
 *
 * Until slackwater-database#210 the database curated identity for exactly these
 * ten and for none of the other 1,047, so the corpus was simply the data and
 * this list would have been noise. #210 gave every live Canadian tide station a
 * record, which is what #17 needs — and more than this site has decided to
 * publish: a page for one of the other 1,047 carries identity and no
 * prediction, and the on-request DFO curve it would need is the rest of #17.
 *
 * So the list exists to keep that a decision rather than a side effect of a
 * database release, and it is meant to be deleted. When #17 answers, this goes
 * and the corpus is the data again.
 */
const CHS_TIDE_PORTS = new Set([
  'chs-campbell-river',
  'chs-fulford-harbour',
  'chs-owen-bay',
  'chs-point-atkinson',
  'chs-port-alberni',
  'chs-port-renfrew',
  'chs-sooke',
  'chs-tofino',
  'chs-vancouver',
  'chs-victoria',
])

/**
 * The Canadian stations of one kind, from identity the database already
 * publishes.
 *
 * All 24 gates and the ten named tide ports are curated records with a name,
 * region, corrected position, timezone and province. Since
 * slackwater-database#210 so are the other 1,047 tide ports, which this site
 * does not publish yet: identity is no longer what stops them, a prediction is,
 * and that is the rest of #17.
 */
export function chsStations(kind: Kind): ChsStation[] {
  const out: ChsStation[] = []
  for (const s of curatedRecords) {
    if (s.source?.name !== CHS_SOURCE || s.kind !== kind) continue
    if (EXCLUDED.has(s.id)) continue
    // Every gate is published; the tide ports are the named ten — see CHS_TIDE_PORTS.
    if (kind === 'tide' && !CHS_TIDE_PORTS.has(s.id)) continue
    const route = stationRoute(kind, s.id)
    // A station with no published route is a broken corpus, not one to skip: it
    // means the database's records and its route index disagree about what exists.
    if (!route) throw new Error(`registry: no published route for CHS ${kind} station ${s.id}`)
    const { slug, path } = route
    const region = s.context_derived ? undefined : s.context
    // The province a page competes for ("tides victoria bc") is read rather
    // than guessed from the position; a record with no Canadian code gets
    // none, because an invented one puts a station under the wrong heading.
    const code = String(s.region_code ?? '')
    const state = code.startsWith('CA-') ? code.slice(3) : undefined
    out.push({
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
    })
  }
  return out
}
