//
// BUILD-TIME ONLY. Never import this from a route module: it pulls the whole
// station database, and TanStack loaders are isomorphic, so one careless import
// ships megabytes to every visitor. Task 4 asserts that.
import { stationRoutes, stations, stationsById } from '@slackwater/database'
import { FEET_PER_METRE } from './format'
import { kindRoot } from './places'
import { chsStations, curatedBySlug, REGISTRY_IDS } from './registry'
import type { BundledStation, Constituent, CurrentReduction, Kind, Station } from './station'

/**
 * A station is buildable when a provider row ships its constituents, which the
 * id shape tells us: `noaa/…` and `ticon/…` are provider rows, while a bare
 * key (`chs-victoria`, `noaa-boundary-pass`) is identity the database curates
 * and carries no constituents for.
 *
 * Filtering on the id shape rather than a `chs-` prefix is what makes this one
 * rule instead of a rule plus an exception: `noaa-boundary-pass` is curated
 * despite its name, and a prefix test silently lets it through to a throw.
 * Those stations are excluded from v1 and tracked in issue #17.
 */
export function isBuildable(id: string): boolean {
  return id.includes('/')
}

/**
 * Every station id the database's quality pass accepts.
 *
 * `stations` is the database's own accepted list — `allStations.filter(qualityFilter)` —
 * so the rule this site publishes by is the database's rule rather than a copy
 * of it that drifts. A station carrying no verdict counts as accepted, which is
 * what the database itself does, and 2,561 provider rows are in that state.
 *
 * The rule is what makes the whole corpus publishable: it rejects 1,851 of the
 * 7,694 commercially licensed routes, and 973 of those are a second provider's
 * row for a gauge the site already publishes (slackwater-database#191). Without
 * it, adopting the corpus would double the duplicate pages rather than remove
 * them.
 */
const ACCEPTED = new Set(stations.map((s) => s.id))

// A release that shipped no verdicts at all would withhold every station and
// build a site of place pages with nothing on them — a corpus-wide failure that
// renders and deploys. Fail the build instead.
if (!ACCEPTED.size) throw new Error('catalogue: the station database ships no quality verdicts')

/**
 * A provider row this site can publish.
 *
 * Commercially licensed, because Slackwater has a paid tier and the site
 * promotes the app: the 674 TICON-4 rows whose GESLA provider forbids
 * commercial use would be a licence breach on a page, not a rendering bug.
 * Read as truthiness rather than `!== false`, so a release that drops the field
 * withholds the corpus instead of quietly publishing them.
 *
 * Harmonic constituents or, for a NOAA current, a published reduction against
 * an exact reference row. Four NOAA tide subordinates remain excluded because
 * their height reduction is a different model.
 */
function publishable(r: Record<string, unknown>): boolean {
  const license = r.license as { commercial_use?: boolean } | undefined
  if (!license) throw new Error(`catalogue: no licence on ${String(r.id)}`)
  const harmonic = ((r.harmonic_constituents ?? []) as unknown[]).length > 0
  const subordinate = r.kind === 'current' && Boolean((r.current as { offsets?: unknown } | undefined)?.offsets)
  return Boolean(license.commercial_use) && (harmonic || subordinate)
}

/** A subdivision code the provider published rather than the gazetteer. */
const USPS = /^[A-Z]{2}$/

/**
 * The constituents that are the tide itself, and the seasonal band measured
 * against them.
 *
 * Mirrors `TIDAL_CONSTITUENTS` and `SEASONAL_CONSTITUENTS` in
 * `@slackwater/stations`, which is private to the database repo, so the lists
 * cannot be imported. Only the RATIO is computed here and only to choose how
 * loudly a page speaks — the verdict is `quality.seasonal_dominant` and comes
 * from the database — so if the lists ever drift apart a marginal station moves
 * between bands rather than gaining or losing its label.
 *
 * The minor terms are not padding: at 159 stations the largest tidal
 * constituent is one of them rather than a major, by up to 85%, and those are
 * exactly the near-tideless stations this measures. Trimming the list to the
 * eight majors would inflate the ratio and make those pages overstate their case.
 */
const TIDAL = [
  'M2', 'S2', 'N2', 'K2', 'L2', 'T2', 'NU2', 'MU2', '2N2', 'LDA2',
  'K1', 'O1', 'P1', 'Q1', 'J1', 'M1', 'OO1', 'RHO1', '2Q1', 'SIGMA1',
  'CHI1', 'PI1', 'PHI1', 'THETA1', 'S1',
]
const SEASONAL = ['SA', 'SSA']

/**
 * How many times the seasonal band exceeds the largest tidal constituent, for a
 * station the database labelled seasonal — and `undefined` for every other,
 * which is what a page reads to decide whether to say anything at all.
 *
 * Measured on the same amplitudes the database used, in metres, before the
 * catalogue converts to feet: a ratio has no unit, but taking it after a
 * one-sided conversion would not.
 */
function seasonalRatio(r: Record<string, unknown>): number | undefined {
  if (!(r.quality as { seasonal_dominant?: boolean } | undefined)?.seasonal_dominant) return undefined
  const constituents = (r.harmonic_constituents ?? []) as Constituent[]
  const amplitude = (name: string) =>
    Math.abs(constituents.find((c) => c.name === name)?.amplitude ?? 0)
  const seasonal = Math.max(...SEASONAL.map(amplitude))
  const tidal = Math.max(...TIDAL.map(amplitude))
  // The database labels nothing with a zero denominator, so this is a broken
  // release rather than a station to quietly un-label.
  if (!tidal) throw new Error(`catalogue: ${String(r.id)} is labelled seasonal with no tidal constituent`)
  return seasonal / tidal
}

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
 */
function waterContext(r: Record<string, unknown>): string | undefined {
  const own = r.context_derived ? undefined : r.context
  return own ? String(own) : undefined
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
  return r.region ? String(r.region) : undefined
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
 * `@slackwater/database` ships tide amplitudes in METRES (Boston M2 = 1.371,
 * a 9.5 ft range once summed) and current amplitudes in knots. The
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

function record(id: string): Record<string, unknown> | undefined {
  const db = stationsById as unknown
  return db instanceof Map ? db.get(id) : (db as Record<string, never>)[id]
}

function currentReduction(r: Record<string, unknown>): CurrentReduction | undefined {
  if (((r.harmonic_constituents ?? []) as unknown[]).length) return undefined
  const offsets = (r.current as { offsets?: Record<string, unknown> } | undefined)?.offsets
  if (!offsets) return undefined
  const referenceId = String(offsets.reference ?? '')
  const reference = record(referenceId)
  const referenceConstituents = (reference?.harmonic_constituents ?? []) as Constituent[]
  if (!reference || !referenceConstituents.length)
    throw new Error(`catalogue: invalid current reference ${referenceId} on ${String(r.id)}`)
  const referenceCurrent = (reference.current ?? {}) as Record<string, number | undefined>
  const reduction = {
    referenceId,
    referenceConstituents,
    referenceOffset: referenceCurrent.mean_flow ?? 0,
    slackBeforeFloodOffset: Number(offsets.slack_before_flood) * 60,
    slackBeforeEbbOffset: Number(offsets.slack_before_ebb) * 60,
    floodTimeOffset: Number(offsets.flood_time) * 60,
    ebbTimeOffset: Number(offsets.ebb_time) * 60,
    floodSpeedRatio: Number(offsets.flood_speed_ratio),
    ebbSpeedRatio: Number(offsets.ebb_speed_ratio),
  }
  if (Object.values(reduction).some((value) => typeof value === 'number' && !Number.isFinite(value)))
    throw new Error(`catalogue: invalid current offsets on ${String(r.id)}`)
  return reduction
}

export function loadCatalogue(): Station[] {
  const out: Station[] = []

  for (const kind of ['tide', 'current'] as Kind[]) {
    const curated = curatedBySlug(kind)
    // The database's route index IS the corpus: every station it gives an
    // address to, minus the ones this site may not or cannot publish. Reading
    // the addresses from the same place the pages link to them from is what
    // makes a published slug and a published page the same set by construction
    // rather than by agreement between two tables.
    for (const { slug, path, stationIds } of stationRoutes(kind)) {
      for (const id of stationIds) {
        if (!isBuildable(id)) continue
        const r = record(id)
        // A routed id with no record is a broken database, not a station to
        // skip: the route index and the records disagree about what exists.
        if (!r) throw new Error(`catalogue: no ${kind} data for ${id}`)
        if (!publishable(r) || !ACCEPTED.has(id)) continue
        const constituents = (r.harmonic_constituents ?? []) as BundledStation['constituents']
        const seasonal = kind === 'tide' ? seasonalRatio(r) : undefined
        const state = subdivision(r)
        const area = adminArea(r)
        const current = (r.current ?? {}) as Record<string, number | undefined>
        const reduction = kind === 'current' ? currentReduction(r) : undefined
        out.push({
          id, kind, slug, path,
          source: 'bundled',
          // Curated identity wins. The provider row names the water whatever the
          // provider calls it; the curated record names it what a mariner calls it.
          name: curated.get(slug)?.name ?? String(r.name),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone),
          // A NOAA current's own qualifier is a bearing off the named place —
          // "0.4 nm SE of" — and heading a page by it says nothing, so a
          // current's water comes from curated identity alone.
          region: curated.get(slug)?.region ?? (kind === 'tide' ? waterContext(r) : undefined),
          ...(area ? { area } : {}),
          ...(r.country ? { country: String(r.country) } : {}),
          ...(r.continent ? { continent: String(r.continent) } : {}),
          ...(state ? { state } : {}),
          ...(kind === 'tide'
            ? {
                constituents: constituents.map((c) => ({ ...c, amplitude: c.amplitude * FEET_PER_METRE })),
                chartDatum: String(r.chart_datum ?? ''),
                publisher: String((r.source as { name?: string } | undefined)?.name ?? ''),
                attribution: String(r.attribution ?? ''),
                offset: datumShift(r),
                ...(seasonal !== undefined ? { seasonal } : {}),
              }
            : {
                constituents,
                // Mean flow: the constant term under the harmonic sum, in knots.
                offset: current.mean_flow ?? 0,
                floodDirection: current.flood_direction,
                ebbDirection: current.ebb_direction,
                ...(reduction ? { reduction } : {}),
              }),
        })
      }
    }
  }

  // The Canadian gates, and the ten tide ports whose identity the database
  // curates. Both carry no prediction: DFO's terms do not allow re-serving
  // one, so the reader's own browser fetches it. The other 1,048 ports have
  // identity nowhere published — see #17.
  out.push(...chsStations('current'), ...chsStations('tide'))

  // One row per slug. The database merges duplicate identities by putting
  // both ids on one route, so a slug can arrive twice. Prefer the id the
  // database curates - that is the curated half in every merged pair - and
  // fall back to first-seen so this is total rather than conditional.
  const bySlug = new Map<string, Station>()
  for (const s of out) {
    const key = `${s.kind}/${s.slug}`
    const held = bySlug.get(key)
    if (!held || (!REGISTRY_IDS.has(held.id) && REGISTRY_IDS.has(s.id))) bySlug.set(key, s)
  }
  return [...bySlug.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Every address a route the quality pass rejects can be asked for, mapped to
 * that route's canonical path.
 *
 * 1,851 commercially licensed routes fail the quality rule, and 357 of them
 * were pages here before the site read the whole corpus, so their addresses
 * have to answer rather than 404. Keeping the set derived from the database
 * instead of a list of the 357 is what makes it cover the other 1,494 too, and
 * every station a later release rejects.
 *
 * Both addresses a reader can arrive on are keys: the canonical path under its
 * country and subdivision, and the flat `/tides/<slug>/` the app's share sheet
 * mints. The destination is deliberately NOT resolved here — the nearest page
 * above a station is whichever place page exists, and only
 * `catalogue-server.ts` holds the place tree that says which do.
 */
export function loadWithheld(): Map<string, string> {
  const out = new Map<string, string>()
  for (const kind of ['tide', 'current'] as Kind[])
    for (const { slug, path, stationIds } of stationRoutes(kind)) {
      const rows = stationIds.filter((id) => {
        const r = isBuildable(id) ? record(id) : undefined
        return r && publishable(r)
      })
      // A route with nothing publishable on it never had a page to withhold —
      // a non-commercial row or an unimplemented tide subordinate is out on its own terms, and the
      // curated CHS records have no provider row at all. A route with one
      // accepted row has a page, whatever else sits beside it.
      if (!rows.length || rows.some((id) => ACCEPTED.has(id))) continue
      out.set(path, path)
      out.set(`${kindRoot(kind)}${slug}/`, path)
    }
  return out
}
