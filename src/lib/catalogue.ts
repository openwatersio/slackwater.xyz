//
// BUILD-TIME ONLY. Never import this from a route module: it pulls the whole
// tide database and the current bundle, and TanStack loaders are isomorphic, so
// one careless import ships megabytes to every visitor. Task 4 asserts that.
import { cleanName } from '@openwaters/station-metadata'
import corrections from '@openwaters/station-metadata/data/corrections.json' with { type: 'json' }
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import currentBundle from '@openwaters/noaa-current-stations/currents.json' with { type: 'json' }
import { stationsById } from '@neaps/tide-database'
import tzLookup from 'tz-lookup'
import { FEET_PER_METRE } from './format'
import { chsStations, curatedBySlug, REGISTRY_IDS } from './registry'
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
const overrides = corrections as Record<string, { name?: string; context?: string }>

/** A subdivision code the provider published rather than the gazetteer. */
const USPS = /^[A-Z]{2}$/

/**
 * The water a station sits in, for the heading above it and the line under its
 * name.
 *
 * `context` is the half the database separates out of a provider's
 * comma-joined name — "Turkey Point, Hudson River" becomes the point and the
 * river — and that half is exactly what this wants. But the same field is also
 * filled from a gazetteer when the provider published no qualifier, and a
 * derived one names the nearest settlement: 2,736 of them read "Downtown, HI"
 * or "Waialua, HI". A neighbourhood is not the water, and as a heading it
 * groups stations by nothing. `context_derived` is the database's own flag for
 * which is which, so only the provider's own half is taken.
 *
 * It shouts as often as a name does, so it gets the same cleaning.
 */
function waterContext(r: Record<string, unknown>): string | undefined {
  const own = r.context_derived ? undefined : r.context
  return own ? cleanName(String(own)) : undefined
}

/**
 * The jurisdiction a station sits in, spelled out — "Hokkaido", "British
 * Columbia", "ME".
 *
 * Kept apart from the water because the two make good headings on different
 * pages. Grouping Japan's 198 stations by prefecture is the only structure
 * that page has; grouping British Columbia's by "British Columbia" says
 * nothing, and the provider rows near the border say "Alaska" on stations the
 * gazetteer places in BC — a heading that reads as a contradiction on a page
 * titled for the province. `placeIndex` picks which one a page uses.
 */
function adminArea(r: Record<string, unknown>): string | undefined {
  return r.region ? cleanName(String(r.region)) : undefined
}

/**
 * The subdivision a station sits in, where the database vouches for one.
 *
 * `region_code` is ISO 3166-2 — `US-WA`, `CA-BC` — and the database emits it
 * only where a gazetteer confirmed it, which is the United States and Canada
 * and nowhere else. `region` beside it is a display name and is not safe to
 * route on: US rows carry whatever NOAA published, so the same state appears
 * as both "WA" and "Washington". The code is the identity; the name is not.
 *
 * The country prefix is checked rather than assumed, because a code that does
 * not agree with its own country would put a station under another country's
 * subdivision.
 *
 * Where the gazetteer could not confirm a code, a US row falls back to the
 * USPS code NOAA itself published — 159 stations, most of them Alaskan, that
 * would otherwise sit on the country page rather than in the state they are
 * plainly in. The fallback stays US-only: a Canadian row carrying a stray US
 * code (Amherstburg, Ontario is "MI") is the reason it was never wider.
 */
function subdivision(r: Record<string, unknown>): string | undefined {
  const code = String(r.region_code ?? '')
  const country = String(r.country_code ?? '')
  if (country && code.startsWith(`${country}-`)) return code.slice(country.length + 1)
  const region = String(r.region ?? '')
  return country === 'US' && USPS.test(region) ? region : undefined
}

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
// The constant itself lives in `format.ts`: `iwls.ts` needs it too and may
// not import this module.

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
        const override = overrides[id]
        const state = subdivision(r)
        const area = adminArea(r)
        out.push({
          id, kind, slug,
          source: 'bundled',
          // Curated identity wins. The provider row names the water whatever the
          // provider calls it; the registry names it what a mariner calls it.
          name: curated.get(slug)?.name ?? override?.name ?? cleanName(String(r.name)),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone),
          region: curated.get(slug)?.region ?? override?.context ?? waterContext(r),
          ...(area ? { area } : {}),
          ...(r.country ? { country: String(r.country) } : {}),
          ...(r.continent ? { continent: String(r.continent) } : {}),
          ...(state ? { state } : {}),
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
        // A subordinate station carries no constituents of its own: NOAA
        // publishes it as time offsets and flood/ebb speed ratios reduced
        // against a reference station, and `predict.ts` sums constituents.
        // Building one anyway produces a page with a head and no body, which
        // is what 1,692 of these did the first time the slug table grew to
        // include them. The reduction is a prediction the site does not do
        // yet, so the station does not get a page yet — see #80.
        if (!r.constituents) continue
        const override = overrides[id]
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
          name: curated.get(slug)?.name ?? override?.name ?? cleanName(String(r.name)),
          latitude, longitude,
          timezone: tzLookup(latitude, longitude),
          // The NOAA bundle carries no region field at all, so the registry is
          // the only source and there is nothing to fall back to.
          region: curated.get(slug)?.region ?? override?.context,
          // The NOAA bundle carries no country or subdivision either. Every
          // station in it is a US one, which is what makes the constants
          // honest rather than a default.
          country: 'United States',
          continent: 'Americas',
          constituents: r.constituents as BundledStation['constituents'],
          offset: Number(r.offset ?? 0),
          floodDirection: Number(r.floodDirection),
          ebbDirection: Number(r.ebbDirection),
        })
      }
    }
  }

  // The Canadian gates, and the ten tide ports whose identity the registry
  // publishes. Both carry no prediction: DFO's terms do not allow re-serving
  // one, so the reader's own browser fetches it. The other 1,048 ports have
  // identity nowhere published — see #17.
  out.push(...chsStations('current'), ...chsStations('tide'))

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
