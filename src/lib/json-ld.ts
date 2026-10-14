import type { Crumb } from './catalogue-server'
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
export function stationJsonLd(station: Station, url: string, crumbs: Crumb[]): JsonLd[] {
  const address = {
    ...(station.state ? { addressRegion: station.state } : {}),
    ...(station.country ? { addressCountry: station.country } : {}),
  }

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
    breadcrumbs(crumbs, station.name, url),
  ]
}

const listItem = (position: number, name: string, item: string) => ({
  '@type': 'ListItem',
  position,
  name,
  item,
})

/** Home, every page above this one, then this one: the trail the page draws, every item a real page. */
function breadcrumbs(crumbs: Crumb[], name: string, url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      listItem(1, 'Slackwater', `${ORIGIN}/`),
      ...crumbs.map((c, i) => listItem(i + 2, c.label, ORIGIN + c.href)),
      listItem(crumbs.length + 2, name, url),
    ],
  }
}

/**
 * A browse page's structured data: the trail to it, and what it lists.
 *
 * The list is the links the page's body holds, places below it first and
 * then its own stations, so a country page that hands its stations down to
 * its subdivisions still lists those rather than nothing.
 *
 * Capped at `LISTED`, with `numberOfItems` still the whole count, which
 * schema.org allows for a list described in part. Every item costs about 130
 * bytes, and listing all 757 of Florida's put the page 80 KB over the browse
 * budget `station-routes.test.ts` holds it to.
 */
export const LISTED = 100

export function placeJsonLd(
  page: {
    /** The page's own heading: "Washington, United States". */
    title: string
    /** Its last breadcrumb, named as the trail to a station below it names it: "Washington". */
    name: string
    crumbs: Crumb[]
    links: { href: string; name: string }[]
  },
  url: string,
): JsonLd[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: page.title,
      url,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: page.links.length,
        itemListElement: page.links.slice(0, LISTED).map((l, i) => listItem(i + 1, l.name, ORIGIN + l.href)),
      },
    },
    breadcrumbs(page.crumbs, page.name, url),
  ]
}

/**
 * A pass guide's questions as `FAQPage`, each answer the same HTML the page
 * renders — Google asks that the markup match what a reader sees, and its
 * allowed tags cover everything a guide's markdown produces.
 */
export function faqJsonLd(faq: { question: string; html: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.html },
    })),
  }
}
