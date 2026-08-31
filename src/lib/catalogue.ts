//
// BUILD-TIME ONLY. Never import this from a route module: it pulls the whole
// tide database and the current bundle, and TanStack loaders are isomorphic, so
// one careless import ships megabytes to every visitor. Task 4 asserts that.
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import currentBundle from '@openwaters/noaa-current-stations/currents.json' with { type: 'json' }
import { stationsById } from '@neaps/tide-database'
import tzLookup from 'tz-lookup'
import type { Kind, Station } from './station'

/**
 * A station is buildable when a provider catalogue ships its data, which the id
 * shape tells us: `noaa/…` and `ticon/…` come from a package, while a bare
 * registry key (`chs-victoria`, `noaa-boundary-pass`) is identity that
 * station-metadata owns and no package carries constituents for.
 *
 * Filtering on the id shape rather than a `chs-` prefix is what makes this one
 * rule instead of a rule plus an exception: `noaa-boundary-pass` is registry
 * owned despite its name, and a prefix test silently lets it through to a throw.
 * Those stations are excluded from v1 and tracked in issue #17.
 */
export function isBuildable(id: string): boolean {
  return id.includes('/')
}

/** The current bundle keys stations by bare NOAA id; the slug table prefixes them. */
const NOAA = 'noaa/'

function tideRecord(id: string): Record<string, unknown> | undefined {
  const db = stationsById as unknown
  return db instanceof Map ? db.get(id) : (db as Record<string, never>)[id]
}

export function loadCatalogue(): Station[] {
  const currents = new Map(
    (currentBundle.stations as Array<Record<string, never>>).map((s) => [NOAA + s.id, s]),
  )
  const out: Station[] = []

  for (const kind of ['tide', 'current'] as Kind[]) {
    for (const [id, slug] of Object.entries(slugTable[kind] as Record<string, string>)) {
      if (!isBuildable(id)) continue

      if (kind === 'tide') {
        const r = tideRecord(id)
        // A slug with no data is a broken corpus, not a station to skip: it
        // means the slug table and the data package disagree about what exists.
        if (!r) throw new Error(`catalogue: no tide data for ${id}`)
        out.push({
          id, kind, slug,
          name: String(r.name),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone), region: r.region ? String(r.region) : undefined,
          constituents: r.harmonic_constituents as Station['constituents'],
        })
      } else {
        const r = currents.get(id)
        if (!r) throw new Error(`catalogue: no current data for ${id}`)
        const latitude = Number(r.latitude)
        const longitude = Number(r.longitude)
        // The current bundle carries no timezone field at all - derive one from
        // coordinates rather than defaulting to UTC, which would quietly show
        // every current station's slack time seven-plus hours wrong.
        out.push({
          id, kind, slug,
          name: String(r.name),
          latitude, longitude,
          timezone: tzLookup(latitude, longitude),
          constituents: r.constituents as Station['constituents'],
          offset: Number(r.offset ?? 0),
          floodDirection: Number(r.floodDirection),
          ebbDirection: Number(r.ebbDirection),
        })
      }
    }
  }

  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
