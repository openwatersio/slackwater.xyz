//
// BUILD-TIME ONLY, like catalogue.ts: it decodes the tide database's route index.
import { stationRoutes } from '@slackwater/database'
import type { Kind } from './station'

interface Route {
  slug: string
  /** The canonical path, `/tides/us/pa/bridesburg/`. */
  path: string
}

/**
 * The route the tide database publishes for a station, by id.
 *
 * The database allocates a slug once per station and keeps it, and places it
 * under the country and subdivision it sits in. A station's address here is
 * the one every consumer agrees on. That is the whole reason this is read from
 * the database rather than kept in a table of this site's own — two consumers
 * minting URLs from two tables is how a shared link opens the wrong station.
 */
const index = (() => {
  let cache: Map<string, Route> | undefined
  return () => {
    if (!cache) {
      cache = new Map()
      for (const kind of ['tide', 'current'] as Kind[])
        for (const { slug, path, stationIds } of stationRoutes(kind))
          for (const id of stationIds) cache.set(`${kind}/${id}`, { slug, path })
    }
    return cache
  }
})()

export function stationRoute(kind: Kind, id: string): Route | undefined {
  return index().get(`${kind}/${id}`)
}
