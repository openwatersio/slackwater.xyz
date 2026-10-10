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
  const exact = new Set(pages.filter((path) => path !== '/'))
  for (const [parent, paths] of groups) {
    if (!dynamic.has(parent)) for (const path of paths) exact.add(path)
  }
  if (exact.size > 2000) throw new Error('Canonical redirects exceed Cloudflare\'s 2,000 static rule limit')
  return [
    ...[...exact].sort().map((path) => `${path.slice(0, -1)} ${path} 308`),
    ...[...dynamic].sort().map((parent) => `${parent}/:page ${parent}/:page/ 308`),
  ].join('\n') + '\n'
}
