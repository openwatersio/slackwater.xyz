import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import { formerSlugs } from './routes'
import { stationPath, type Station } from './station'

/**
 * Cloudflare reads at most this many static rules from `_redirects`; past it
 * the file is rejected whole, so the build fails here rather than at deploy.
 */
export const REDIRECT_LIMIT = 2000

/**
 * Every path this site once published for a station, sent to where it is now.
 *
 * Two sources, because the two halves of the history live in different
 * places. The database records a slug it retired as a former path. The slug
 * table this site published from before it read routes is the other half:
 * for a station the database never renamed but this site addressed
 * differently, only that table knows the old URL.
 *
 * A rule whose source is still a live page would shadow it — Cloudflare
 * follows `_redirects` whether or not an asset matches — so that is an error
 * here, not a rule.
 */
export function buildRedirects(stations: Station[]): string {
  const live = new Set(stations.map((s) => stationPath(s.kind, s.slug)))
  const rules = new Map<string, string>()
  for (const s of stations) {
    const published = (slugTable[s.kind] as Record<string, string>)[s.id]
    for (const old of new Set([published, ...formerSlugs(s.kind, s.id)])) {
      if (!old || old === s.slug) continue
      const from = stationPath(s.kind, old)
      if (live.has(from)) throw new Error(`redirects: ${from} is still a live page`)
      rules.set(from, stationPath(s.kind, s.slug))
    }
  }
  if (rules.size * 2 > REDIRECT_LIMIT)
    throw new Error(`redirects: ${rules.size * 2} rules, Cloudflare stops reading at ${REDIRECT_LIMIT}`)
  // Both spellings of every source. `_redirects` matches a path exactly, and
  // a shared link from the app carries no trailing slash — today the asset
  // layer adds one and finds the page, but a page that has moved is not there
  // to find, so the bare form would fall through to a 404.
  return [...rules]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([from, to]) => [`${from.slice(0, -1)} ${to} 301`, `${from} ${to} 301`])
    .join('\n')
    .concat('\n')
}
