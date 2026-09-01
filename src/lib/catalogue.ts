//
// BUILD-TIME ONLY. Never import this from a route module: it pulls the whole
// tide database and the current bundle, and TanStack loaders are isomorphic, so
// one careless import ships megabytes to every visitor. Task 4 asserts that.
import { cleanName } from '@openwaters/station-metadata'
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import currentBundle from '@openwaters/noaa-current-stations/currents.json' with { type: 'json' }
import { stationsById } from '@neaps/tide-database'
import tzLookup from 'tz-lookup'
import { chsGates, curatedBySlug, REGISTRY_IDS } from './registry'
import type { BundledStation, Kind, Station } from './station'

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

/**
 * `@neaps/tide-database` ships tide amplitudes in METRES (Boston M2 = 1.371,
 * a 9.5 ft range once summed) — the current bundle is already in knots. The
 * site speaks feet, so the conversion happens once, here, at the boundary
 * where provider data enters: from this point on a tide `Station` is in feet
 * and no renderer has to know what a provider chose. Labelling a metre "ft"
 * at the far end is wrong by 3.28x and looks entirely plausible.
 *
 * A constituent sum has no datum in it: it comes out relative to MSL, which is
 * why every low used to read negative. `datumShift` below moves each station
 * onto the datum its own charts are drawn to, at this same boundary and in the
 * same unit, so no renderer has to know either.
 */
const FEET_PER_METRE = 3.28084

/**
 * Metres from MSL down to this station's chart datum, in feet.
 *
 * Mirrors the app exactly (`tools/gen-tides.mjs`: `datums.MSL - datums[chart_datum]`),
 * because the site and the app have to say the same number about the same water.
 * `chart_datum` is per station and is not always MLLW — the corpus spans eight
 * datums, and MLLW covers barely half of it.
 *
 * No datums shipped means no shift. Two stations are in that state and the app
 * labels both STND: an invented offset would render to one decimal place and be
 * indistinguishable on the page from a measured one.
 */
function datumShift(r: Record<string, unknown>): number {
  const datums = r.datums as Record<string, number> | undefined
  const chartDatum = String(r.chart_datum ?? '')
  if (datums?.MSL == null || datums[chartDatum] == null) return 0
  return (datums.MSL - datums[chartDatum]) * FEET_PER_METRE
}

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
    const curated = curatedBySlug(kind)
    for (const [id, slug] of Object.entries(slugTable[kind] as Record<string, string>)) {
      if (!isBuildable(id)) continue

      if (kind === 'tide') {
        const r = tideRecord(id)
        // A slug with no data is a broken corpus, not a station to skip: it
        // means the slug table and the data package disagree about what exists.
        if (!r) throw new Error(`catalogue: no tide data for ${id}`)
        out.push({
          id, kind, slug,
          source: 'bundled',
          // Curated identity wins. The provider row names the water whatever the
          // provider calls it; the registry names it what a mariner calls it.
          name: curated.get(slug)?.name ?? cleanName(String(r.name)),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone),
          region: curated.get(slug)?.region ?? (r.region ? String(r.region) : undefined),
          constituents: (r.harmonic_constituents as BundledStation['constituents']).map((c) => ({
            ...c,
            amplitude: c.amplitude * FEET_PER_METRE,
          })),
          chartDatum: String(r.chart_datum ?? ''),
          offset: datumShift(r),
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
          source: 'bundled',
          // Curated identity wins. The provider row names the water whatever the
          // provider calls it; the registry names it what a mariner calls it.
          name: curated.get(slug)?.name ?? cleanName(String(r.name)),
          latitude, longitude,
          timezone: tzLookup(latitude, longitude),
          // The NOAA bundle carries no region field at all, so the registry is
          // the only source and there is nothing to fall back to.
          region: curated.get(slug)?.region,
          constituents: r.constituents as BundledStation['constituents'],
          offset: Number(r.offset ?? 0),
          floodDirection: Number(r.floodDirection),
          ebbDirection: Number(r.ebbDirection),
        })
      }
    }
  }

  out.push(...chsGates())

  // One row per slug. station-metadata merges duplicate identities by pointing
  // both ids at one slug (4.1.2), so a slug can arrive twice. Prefer the id the
  // registry names - that is the curated half in every merged pair - and fall
  // back to first-seen so this is total rather than conditional.
  const bySlug = new Map<string, Station>()
  for (const s of out) {
    const key = `${s.kind}/${s.slug}`
    const held = bySlug.get(key)
    if (!held || (!REGISTRY_IDS.has(held.id) && REGISTRY_IDS.has(s.id))) bySlug.set(key, s)
  }
  return [...bySlug.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
