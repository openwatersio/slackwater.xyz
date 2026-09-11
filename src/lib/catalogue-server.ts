import { createServerFn } from '@tanstack/react-start'
import { loadCatalogue } from './catalogue'
import { bearing, distanceNm, neighbourMap } from './nearby'
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
      .map((s) => ({ slug: s.slug, name: s.name, ...(s.region ? { region: s.region } : {}) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )

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
