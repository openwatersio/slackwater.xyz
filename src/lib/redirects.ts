import FORMER_BROWSE_PATHS from './former-browse-paths.json' with { type: 'json' }

// The browse pages the site published under /stations/ before they moved to
// /tides/ and /currents/, each against its replacement. Search engines indexed
// them, so they keep answering. The table is frozen because the old addresses
// are a fixed set, keyed by country names the site no longer puts in a URL.
// A former page whose replacement is no longer published gets no rule and 404s
// rather than sending a reader to another 404.
const MOVED: Record<string, string> = FORMER_BROWSE_PATHS

/** Cloudflare allows 100 dynamic and 2,000 static rules in `_redirects`. */
export function buildRedirects(stations: string[], pages: string[] = []): string {
  const groups = new Map<string, string[]>()
  for (const path of stations) {
    const parent = path.slice(0, path.lastIndexOf('/', path.length - 2))
    const group = groups.get(parent) ?? []
    group.push(path)
    groups.set(parent, group)
  }
  const dynamic = new Set(
    [...groups].filter(([, paths]) => paths.length > 1)
      .sort(([a, x], [b, y]) => y.length - x.length || a.localeCompare(b))
      .slice(0, 100).map(([parent]) => parent),
  )
  const published = new Set(pages)
  const moved = Object.entries(MOVED).filter(([, to]) => published.has(to))
  const exact = new Set(pages.filter((path) => path !== '/'))
  for (const [parent, paths] of groups) {
    if (!dynamic.has(parent)) for (const path of paths) exact.add(path)
  }
  if (exact.size + moved.length * 2 > 2000) throw new Error('Canonical redirects exceed Cloudflare\'s 2,000 static rule limit')
  return [
    // Both spellings: nothing else gives these paths their trailing slash.
    ...moved.flatMap(([from, to]) => [`${from.slice(0, -1)} ${to} 301`, `${from} ${to} 301`]),
    ...[...exact].sort().map((path) => `${path.slice(0, -1)} ${path} 308`),
    ...[...dynamic].sort().map((parent) => `${parent}/:page ${parent}/:page/ 308`),
  ].join('\n') + '\n'
}
