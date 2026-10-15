import type { Station } from './station'

const ORIGIN = 'https://slackwater.xyz'
export const STATIC_PATHS = ['/', '/about/', '/contact/', '/pricing/', '/support/', '/privacy/', '/accuracy/', '/opencpn/', '/learn/tides/', '/learn/slack-water/', '/stations/']

/** A W3C date (YYYY-MM-DD) for a site path such as `/support/`. */
export type Lastmod = (path: string) => string

const urlset = (paths: string[], lastmod: Lastmod) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  paths.map((p) => `  <url><loc>${ORIGIN}${p}</loc><lastmod>${lastmod(p)}</lastmod></url>\n`).join('') +
  '</urlset>\n'

// No /currents/<slug>/<instant> URLs here on purpose: that path is unbounded
// and every instant canonicalises back to its bare station URL, so listing
// them would just hand crawlers an infinite space to fall into.

/**
 * Four files, not three: a <sitemapindex> may only contain <sitemap><loc>
 * entries pointing at other sitemaps, so the static pages need their own
 * urlset rather than being tucked into the index — a urlset there is
 * invalid and Search Console rejects the whole file.
 */
export function buildSitemaps(
  stations: Station[],
  extraStatic: string[],
  lastmod: Lastmod,
): Record<string, string> {
  const children = {
    'sitemap-static.xml': [...STATIC_PATHS, ...extraStatic],
    'sitemap-tides.xml': stations.filter((s) => s.kind === 'tide').map((s) => s.path),
    'sitemap-currents.xml': stations.filter((s) => s.kind === 'current').map((s) => s.path),
  }
  // ISO dates compare as strings, so the newest is the lexical maximum.
  const newest = (paths: string[]) => paths.map(lastmod).reduce((a, b) => (b > a ? b : a), '')

  return {
    ...Object.fromEntries(Object.entries(children).map(([f, paths]) => [f, urlset(paths, lastmod)])),
    'sitemap.xml':
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      Object.entries(children)
        .map(([f, paths]) => `  <sitemap><loc>${ORIGIN}/${f}</loc><lastmod>${newest(paths)}</lastmod></sitemap>\n`)
        .join('') +
      '</sitemapindex>\n',
  }
}
