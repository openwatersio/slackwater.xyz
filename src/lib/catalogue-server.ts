import { createServerFn } from '@tanstack/react-start'
import { loadCatalogue } from './catalogue'
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

export const stationBySlug = createServerFn({ method: 'GET' })
  .validator((data: { kind: Kind; slug: string }) => data)
  .handler(({ data }) => index().get(`${data.kind}/${data.slug}`))
