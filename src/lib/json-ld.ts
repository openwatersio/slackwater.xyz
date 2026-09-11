import type { Station } from './station'

/**
 * The origin, spelled out rather than imported: `sitemap.ts` keeps its own copy
 * private and this module has to be safe to import from a route that renders in
 * the browser. Two literals, one domain that has never moved.
 */
const ORIGIN = 'https://slackwater.xyz'

/** The shape `head()` accepts under `script:ld+json`: JSON, nothing richer. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined }
export type JsonLd = { [key: string]: Json | undefined }

/**
 * A station page's structured data: where the water is, and where the page sits.
 *
 * Two objects rather than one graph — a `Place` and a `BreadcrumbList` answer
 * different questions and Google reads them from separate `<script>` blocks
 * just as happily.
 *
 * `address` is omitted entirely when neither field is known. An empty
 * `PostalAddress` is worse than none: it asserts a place we cannot name, and
 * Search Console reports it as an error rather than ignoring it.
 */
export function stationJsonLd(station: Station, url: string): JsonLd[] {
  const tide = station.kind === 'tide'
  const address = {
    ...(station.state ? { addressRegion: station.state } : {}),
    ...(station.country ? { addressCountry: station.country } : {}),
  }
  const crumb = (position: number, name: string, item: string) => ({
    '@type': 'ListItem',
    position,
    name,
    item,
  })

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: station.name,
      url,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: station.latitude,
        longitude: station.longitude,
      },
      ...(Object.keys(address).length ? { address: { '@type': 'PostalAddress', ...address } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        crumb(1, 'Slackwater', `${ORIGIN}/`),
        crumb(
          2,
          tide ? 'Tide stations' : 'Current stations',
          `${ORIGIN}/stations/${tide ? 'tides' : 'currents'}/`,
        ),
        crumb(3, station.name, url),
      ],
    },
  ]
}
