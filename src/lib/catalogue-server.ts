import { createServerFn } from '@tanstack/react-start'
import { loadCatalogue } from './catalogue'
import { bearing, distanceNm, neighbourMap } from './nearby'
import { placePath, placeTree, stationPlace } from './places'
import type { Kind, Station } from './station'

/**
 * The only way a route may reach the catalogue.
 *
 * Route loaders are isomorphic — they also run on the client during
 * client-side navigation — so a plain function wrapping `loadCatalogue()`
 * still ends up imported into the client bundle even behind
 * `createServerOnlyFn`, which only guards the call at runtime, not the import
 * at build time. `createServerFn` is the boundary that actually code-splits:
 * the client gets an RPC stub, and this handler — with the whole tide
 * database behind it — never ships. Routes call this; nothing else imports
 * `catalogue.ts` directly except this file and the build-time sitemap and
 * prerender-list generators.
 */
const index = (() => {
  let cache: Map<string, Station> | undefined
  return () => {
    if (!cache) {
      cache = new Map()
      for (const s of loadCatalogue()) cache.set(`${s.kind}/${s.slug}`, s)
    }
    return cache
  }
})()

/** One row of the browse index: enough to render a link, and nothing else. */
export interface StationRow {
  slug: string
  name: string
  region?: string
}

const toRow = (s: Pick<Station, 'slug' | 'name' | 'region'>): StationRow => ({
  slug: s.slug,
  name: s.name,
  ...(s.region ? { region: s.region } : {}),
})

const byName = (a: StationRow, b: StationRow) => a.name.localeCompare(b.name)

/**
 * Every station of one kind, for the browse index.
 *
 * Deliberately NOT `Station[]`: the full record carries the harmonic
 * constituents, and 4,792 of those serialised into a page's loader data would
 * put the tide database back on the wire that `stationBySlug` exists to keep it
 * off. Three fields per station is the whole payload.
 */
export const stationList = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind }) => data)
  .handler(({ data }): StationRow[] =>
    [...index().values()]
      .filter((s) => s.kind === data.kind)
      .map(toRow)
      .sort(byName),
  )

/** One child page of a browse index: a country, or a subdivision of one. */
export interface PlaceLink {
  href: string
  name: string
  count: number
  /** Only countries carry one; subdivisions are already under their country. */
  continent?: string
}

/** What one page of the browse hierarchy renders. */
export interface PlaceIndex {
  /** The place this page is of. Absent on the worldwide index, which is of no place. */
  name?: string
  /** The page one level up, resolved here because only this side knows the names. */
  up?: { href: string; label: string }
  /** Pages below this one. Empty on a page that holds stations and nothing else. */
  places: PlaceLink[]
  /** The stations that live on this page rather than on a child of it. */
  rows: StationRow[]
  /** Every station under this page, child pages included. */
  count: number
}

/**
 * One kind's stations, and the place tree over them, built once each.
 *
 * Both are the same for all 149 place pages the prerender asks for, and
 * rebuilding the tree per page walked the whole catalogue 149 times. Same
 * reason `neighbours` below is cached, and the same lesson: a per-request
 * scan of the catalogue is what put the first prerender past three seconds a
 * page.
 */
const memoByKind = <T,>(build: (kind: Kind) => T) => {
  const cache = new Map<Kind, T>()
  return (kind: Kind): T => {
    let held = cache.get(kind)
    if (!held) cache.set(kind, (held = build(kind)))
    return held
  }
}
const stationsOfKind = memoByKind((kind) => [...index().values()].filter((s) => s.kind === kind))
const trees = memoByKind((kind) => placeTree(stationsOfKind(kind)))

/**
 * One page of the geographic browse hierarchy: `/stations/tides/`, a country
 * under it, or a subdivision under that.
 *
 * The whole point of this function is what it does NOT return. The flat index
 * it replaces serialised 4,792 rows into one page's loader data — 322 KB of a
 * 922 KB page, for a list nothing on the client ever reads back. Asking for
 * one place at a time keeps both the rendered list and that payload
 * proportional to the place, so neither grows when the corpus does. See #33.
 *
 * `undefined` for a country or subdivision the catalogue does not have, so the
 * route can 404 rather than render an empty page for any URL that parses.
 */
export const placeIndex = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; country?: string; state?: string }) => data)
  .handler(({ data }): PlaceIndex | undefined => {
    const { kind, country, state } = data
    const mine = stationsOfKind(kind)
    const tree = trees(kind)

    if (!country) {
      return {
        places: tree.map((c) => ({
          href: placePath(kind, c.slug),
          name: c.name,
          count: c.count,
          continent: c.continent,
        })),
        rows: [],
        count: mine.length,
      }
    }

    const node = tree.find((c) => c.slug === country)
    if (!node) return undefined
    const placed = mine
      .map((s) => ({ s, at: stationPlace(tree, s) }))
      .filter(({ at }) => at?.country.slug === node.slug)

    if (!state) {
      // A split country keeps only the stations its subdivisions do not claim:
      // the handful with no subdivision code would otherwise be unreachable
      // from anywhere but the sitemap.
      const rows = placed.filter(({ at }) => !at!.state).map(({ s }) => s)
      return {
        name: node.name,
        up: { href: placePath(kind), label: kind === 'tide' ? 'Tide stations' : 'Current stations' },
        places: node.states.map((s) => ({
          href: placePath(kind, node.slug, s.slug),
          name: s.name,
          count: s.count,
        })),
        rows: rows.map(toRow).sort(byName),
        count: node.count,
      }
    }

    const sub = node.states.find((s) => s.slug === state)
    if (!sub) return undefined
    return {
      // The subdivision code alone is not a place a reader can put on a map, so
      // it is named the way `copy.ts` names one on a station page: code, then
      // country in full.
      name: `${sub.name}, ${node.name}`,
      up: { href: placePath(kind, node.slug), label: node.name },
      places: [],
      // `region` drops out where it only repeats the subdivision this page is
      // already named for: every US provider row carries the state code in
      // both, and grouping 167 stations under one heading saying "WA" on the
      // WA page is furniture around nothing. A curated water context — the
      // ones that read "Hudson River" — is different, and stays.
      rows: placed
        .filter(({ at }) => at!.state?.slug === state)
        .map(({ s }) => (s.region === s.state ? toRow({ ...s, region: undefined }) : toRow(s)))
        .sort(byName),
      count: sub.count,
    }
  })

/**
 * The nearest stations of the same kind, for the "Nearby" list on a station page.
 *
 * Server-side for the same reason as everything else here: answering it needs
 * the whole catalogue in memory, and the page needs only six names. The
 * neighbour map is built once on first use and reused for every page after.
 * Ranking the catalogue per request instead put every one of the 5,624
 * prerendered renders past three seconds and broke the prerender outright.
 */
const neighbours = (() => {
  let cache: Map<string, Station[]> | undefined
  return () => (cache ??= neighbourMap([...index().values()]))
})()

/**
 * A neighbour carries its position and its leg from the page's station.
 *
 * Only the nearby list is widened, NOT `StationRow`: `stationList` serialises
 * every station of a kind into the browse index's loader data, and four more
 * numbers each is the whole payload growing by more than half for fields that
 * page never renders.
 */
export interface NearbyRow extends StationRow {
  latitude: number
  longitude: number
  /** Great-circle distance from the page's station, nautical miles. */
  nm: number
  /** Initial course FROM the page's station TO this one, degrees true. */
  bearing: number
}

export const nearbyStations = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; slug: string }) => data)
  .handler(({ data }): NearbyRow[] => {
    const station = index().get(`${data.kind}/${data.slug}`)
    if (!station) return []
    return (neighbours().get(station.id) ?? []).map((s) => ({
      slug: s.slug,
      name: s.name,
      ...(s.region ? { region: s.region } : {}),
      latitude: s.latitude,
      longitude: s.longitude,
      nm: distanceNm(station, s),
      bearing: bearing(station, s),
    }))
  })

export const stationBySlug = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; slug: string }) => data)
  .handler(({ data }) => index().get(`${data.kind}/${data.slug}`))
