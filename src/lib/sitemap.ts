import type { Station } from './station'

const ORIGIN = 'https://slackwater.xyz'

const urlset = (locs: string[]) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  locs.map((loc) => `  <url><loc>${loc}</loc></url>\n`).join('') +
  '</urlset>\n'

// No /currents/<slug>/<instant> URLs here on purpose: that path is unbounded
// and every instant canonicalises back to its bare station URL, so listing
// them would just hand crawlers an infinite space to fall into.
const stationLoc = (s: Station) => `${ORIGIN}/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/`

/**
 * Four files, not three: a <sitemapindex> may only contain <sitemap><loc>
 * entries pointing at other sitemaps, so the static pages need their own
 * urlset rather than being tucked into the index — a urlset there is
 * invalid and Search Console rejects the whole file.
 */
export function buildSitemaps(stations: Station[], extraStatic: string[] = []): Record<string, string> {
  const tides = stations.filter((s) => s.kind === 'tide').map(stationLoc)
  const currents = stations.filter((s) => s.kind === 'current').map(stationLoc)
  const staticPages = ['/', '/support/', '/privacy/', '/stations/', '/stations/tides/', '/stations/currents/', ...extraStatic].map(
    (p) => `${ORIGIN}${p}`,
  )

  return {
    'sitemap-tides.xml': urlset(tides),
    'sitemap-currents.xml': urlset(currents),
    'sitemap-static.xml': urlset(staticPages),
    'sitemap.xml':
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      ['sitemap-static.xml', 'sitemap-tides.xml', 'sitemap-currents.xml']
        .map((f) => `  <sitemap><loc>${ORIGIN}/${f}</loc></sitemap>\n`)
        .join('') +
      '</sitemapindex>\n',
  }
}
