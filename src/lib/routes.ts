//
// BUILD-TIME ONLY, like catalogue.ts: it decodes the tide database's route index.
import { stationRoutes } from '@slackwater/database'
import type { Kind } from './station'

interface Route {
  slug: string
  /** Slugs this station published before, in the order the database lists them. */
  former: string[]
}

/**
 * The route the tide database publishes for a station, by id.
 *
 * The database allocates a slug once per station and keeps it: a slug that
 * moves is recorded as a former path and never reused for other water, so a
 * station's address here is the one every consumer agrees on. That is the
 * whole reason this is read from the database rather than kept in a table of
 * this site's own — two consumers minting URLs from two tables is how a shared
 * link opens the wrong station.
 *
 * A `formerPaths` entry is the database's own path shape; only its last
 * segment, the slug, is taken, because this site keeps every station at a flat
 * `/tides/<slug>/` and redirects the old flat path to the new one.
 */
const index = (() => {
  let cache: Map<string, Route> | undefined
  return () => {
    if (!cache) {
      cache = new Map()
      for (const kind of ['tide', 'current'] as Kind[])
        for (const route of stationRoutes(kind)) {
          const former = route.formerPaths.map((p) => p.split('/').filter(Boolean).pop()!)
          for (const id of route.stationIds) cache.set(`${kind}/${id}`, { slug: route.slug, former })
        }
    }
    return cache
  }
})()

export function routeSlug(kind: Kind, id: string): string | undefined {
  return index().get(`${kind}/${id}`)?.slug
}

export function formerSlugs(kind: Kind, id: string): string[] {
  return index().get(`${kind}/${id}`)?.former ?? []
}
