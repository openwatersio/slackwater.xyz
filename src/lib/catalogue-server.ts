import { createServerFn } from '@tanstack/react-start'
import { loadCatalogue, loadWithheld } from './catalogue'
import { bearing, distanceNm, neighbourMap } from './nearby'
import { kindRoot, nearestPlace, parentPath, placeTree, type Place } from './places'
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
  let cache: { bySlug: Map<string, Station>; byPath: Map<string, Station> } | undefined
  return () => {
    if (!cache) {
      cache = { bySlug: new Map(), byPath: new Map() }
      for (const s of loadCatalogue()) {
        cache.bySlug.set(`${s.kind}/${s.slug}`, s)
        cache.byPath.set(s.path, s)
      }
    }
    return cache
  }
})()

/** The addresses of the routes the quality pass rejects, built once — see `loadWithheld`. */
const withheld = (() => {
  let cache: Map<string, string> | undefined
  return () => (cache ??= loadWithheld())
})()

/** One row of the browse index: enough to render a link, and nothing else. */
export interface StationRow {
  slug: string
  path: string
  name: string
  region?: string
}

const toRow = (s: Pick<Station, 'slug' | 'path' | 'name' | 'region'>): StationRow => ({
  slug: s.slug,
  path: s.path,
  name: s.name,
  ...(s.region ? { region: s.region } : {}),
})

/**
 * The same row, headed by jurisdiction where the water does not name itself.
 *
 * A page that spans jurisdictions wants them as headings: Japan's 198 stations
 * have no other structure, and a US state code still tells a reader something
 * on a country page. A page already titled for one jurisdiction does not —
 * see the subdivision branch below.
 */
const toAreaRow = (s: Pick<Station, 'slug' | 'path' | 'name' | 'region' | 'area'>): StationRow =>
  toRow({ ...s, region: s.region ?? s.area })

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

/** One child page of a browse index: a country, or a subdivision of one. */
export interface PlaceLink {
  href: string
  name: string
  count: number
  /** Only countries carry one; subdivisions are already under their country. */
  continent?: string
}

/** A link one level up, or one step of a breadcrumb. */
export interface Crumb {
  href: string
  label: string
}

/** What one page of the browse hierarchy renders. */
export interface PlaceIndex {
  /** The place this page is of. Absent on the worldwide index, which is of no place. */
  name?: string
  /** The page one level up, resolved here because only this side knows the names. */
  up?: Crumb
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
 * Both are the same for every place page the prerender asks for, and
 * rebuilding the tree per page walked the whole catalogue once a page. Same
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
const stationsOfKind = memoByKind((kind) => [...index().bySlug.values()].filter((s) => s.kind === kind))
const trees = memoByKind((kind) => placeTree(stationsOfKind(kind)))
/** Each place page's stations and child places, grouped once rather than filtered per page. */
const children = memoByKind((kind) => {
  const out = new Map<string, { places: Place[]; stations: Station[] }>()
  const at = (path: string) => {
    let held = out.get(path)
    if (!held) out.set(path, (held = { places: [], stations: [] }))
    return held
  }
  for (const p of trees(kind).values()) at(p.up).places.push(p)
  for (const s of stationsOfKind(kind)) at(parentPath(s.path)).stations.push(s)
  return out
})

const rootLabel = (kind: Kind) => (kind === 'tide' ? 'Tide stations' : 'Current stations')

/** The pages above `path`, from the kind's index down to its parent. */
function crumbs(kind: Kind, path: string): Crumb[] {
  const tree = trees(kind)
  const out: Crumb[] = []
  for (let p = parentPath(path); tree.has(p); p = parentPath(p)) out.unshift({ href: p, label: tree.get(p)!.name })
  return [{ href: kindRoot(kind), label: rootLabel(kind) }, ...out]
}

/**
 * One page of the geographic browse hierarchy: `/tides/`, a country under it,
 * or a subdivision under that.
 *
 * The whole point of this function is what it does NOT return. A flat index
 * of every station serialised 4,792 rows into one page's loader data — 322 KB
 * of a 922 KB page, for a list nothing on the client ever reads back. Asking
 * for one place at a time keeps both the rendered list and that payload
 * proportional to the place, so neither grows when the corpus does. See #33.
 *
 * `undefined` for a path that is no place, so the route can 404 rather than
 * render an empty page for any URL that parses.
 */
function placeIndex(kind: Kind, path: string): PlaceIndex | undefined {
  const root = path === kindRoot(kind)
  const place = trees(kind).get(path)
  if (!root && !place) return undefined
  const below = children(kind).get(path) ?? { places: [], stations: [] }
  const subdivision = place && place.up !== kindRoot(kind)
  return {
    ...(place ? { name: place.title, up: crumbs(kind, path).at(-1) } : {}),
    places: below.places
      .map((p) => ({ href: p.path, name: p.name, count: p.count, ...(p.continent ? { continent: p.continent } : {}) }))
      .sort(byName),
    // Water headings only on a subdivision. The jurisdiction is the page's own
    // title, so repeating it says nothing — and the provider rows near a border
    // carry the neighbouring one, which on a page titled "BC, Canada" reads as a
    // contradiction rather than a heading. `area` is dropped there for that
    // reason; `region` is the water and stays.
    rows: below.stations.map(subdivision ? toRow : toAreaRow).sort(byName),
    count: root ? stationsOfKind(kind).length : place!.count,
  }
}

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
  return () => (cache ??= neighbourMap([...index().bySlug.values()]))
})()

/**
 * A neighbour carries its position and its leg from the page's station.
 *
 * Only the nearby list is widened, NOT `StationRow`: a browse page serialises
 * every row it lists into its loader data, and four more numbers each is the
 * payload growing by more than half for fields that page never renders.
 */
export interface NearbyRow extends StationRow {
  latitude: number
  longitude: number
  /** Great-circle distance from the page's station, nautical miles. */
  nm: number
  /** Initial course FROM the page's station TO this one, degrees true. */
  bearing: number
}

function nearby(station: Station): NearbyRow[] {
  return (neighbours().get(station.id) ?? []).map((s) => ({
    ...toRow(s),
    latitude: s.latitude,
    longitude: s.longitude,
    nm: distanceNm(station, s),
    bearing: bearing(station, s),
  }))
}

/** What a path under `/tides/` or `/currents/` is. */
export type Resolved =
  | { page: 'station'; station: Station; nearby: NearbyRow[]; crumbs: Crumb[] }
  | { page: 'place'; path: string; index: PlaceIndex }
  | { page: 'redirect'; path: string }

/**
 * One lookup for every page under a kind's index.
 *
 * A place and a station can share a path's shape — `/tides/us/pa/` is a
 * subdivision, `/tides/jp/kushiro/` a station in a country the database gives
 * no subdivisions — so only the catalogue can say which a path is.
 *
 * A bare `/tides/<slug>/` is the address Slackwater's share sheet mints, and it
 * answers with the station's path so the route can send the reader there. A
 * slug is never two letters, so it cannot be read as a country.
 */
export const resolvePath = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; path: string }) => data)
  .handler(({ data: { kind, path } }): Resolved | undefined => {
    const station = index().byPath.get(path)
    if (station?.kind === kind) return { page: 'station', station, nearby: nearby(station), crumbs: crumbs(kind, path) }
    const place = placeIndex(kind, path)
    if (place) return { page: 'place', path, index: place }
    const slug = path.slice(kindRoot(kind).length, -1)
    const flat = !slug.includes('/') && index().bySlug.get(`${kind}/${slug}`)
    if (flat) return { page: 'redirect', path: flat.path }
    // A route the quality pass rejects has no page, and 357 of them had one
    // here, so the address answers with the nearest page above it rather than
    // a 404.
    const gone = withheld().get(path)
    return gone ? { page: 'redirect', path: nearestPlace(trees(kind), kind, gone) } : undefined
  })

export const stationBySlug = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; slug: string }) => data)
  .handler(({ data }) => index().bySlug.get(`${data.kind}/${data.slug}`))
