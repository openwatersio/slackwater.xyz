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
 * The publisher every page names, the node the home page's graph declares.
 * Spelled out rather than referenced by `@id` alone: Google reads `author` and
 * `publisher` per page, and the full node only lives in the home page's graph.
 */
/** openwaters.io's own description of itself, so the two sites agree. */
export const ORGANIZATION_DESCRIPTION = 'Open source tools and data for understanding and navigating the sea.'

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': 'https://openwaters.io/#organization',
  name: 'Open Waters',
  description: ORGANIZATION_DESCRIPTION,
  url: 'https://openwaters.io/',
}

/**
 * A day as the datetime Google asks for: noon UTC, which is the same calendar
 * day from UTC-12 to UTC+11, so the date still reads as the one the page shows.
 */
const noonUtc = (day?: string) => day && `${day}T12:00:00Z`

/**
 * A page of prose: the learn pages, the comparisons and the accuracy receipt.
 *
 * `dateModified` is the date the page shows, or its sitemap `lastmod` when it
 * shows none, so a crawler reading either is told the same thing. Support and
 * privacy carry no structured data: an Article adds nothing a crawler can use,
 * and Google limits FAQ rich results to government and health sites.
 *
 * The comparisons quote other apps' App Store ratings in prose. Those must
 * never become `Review` or `AggregateRating` here: they are someone else's
 * ratings, and Google treats marking them up on this site as misleading.
 */
export function articleJsonLd(a: {
  headline: string
  description: string
  url: string
  image?: string
  datePublished?: string
  dateModified?: string
  about?: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.headline,
    description: a.description,
    url: a.url,
    mainEntityOfPage: a.url,
    image: a.image ?? `${ORIGIN}/og.png`,
    datePublished: noonUtc(a.datePublished),
    dateModified: noonUtc(a.dateModified),
    inLanguage: 'en',
    author: ORGANIZATION,
    publisher: ORGANIZATION,
    about: a.about ? { '@type': 'Thing', name: a.about } : undefined,
  }
}

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
  return [collectionJsonLd(page.title, url, page.links), breadcrumbs(page.crumbs, page.name, url)]
}

/** A page whose body is a list of links. No breadcrumbs: a trail is marked up only where the page draws one. */
export function collectionJsonLd(name: string, url: string, links: { href: string; name: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: links.length,
      itemListElement: links.slice(0, LISTED).map((l, i) => listItem(i + 1, l.name, ORIGIN + l.href)),
    },
  }
}

/**
 * The OpenCPN download: the station database as a TCD file. `dateModified` is
 * the release date the page prints as "Updated". The license points at the
 * database's own section because one URL cannot say it: most stations are
 * CC BY 4.0 and a few are CC BY-NC 4.0.
 */
export function datasetJsonLd(d: {
  name: string
  description: string
  url: string
  download: string
  dateModified?: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: d.name,
    description: d.description,
    url: d.url,
    dateModified: noonUtc(d.dateModified),
    license: 'https://github.com/openwatersio/slackwater-database#license',
    isAccessibleForFree: true,
    creator: ORGANIZATION,
    publisher: ORGANIZATION,
    // TCD has no registered media type, so this names the format instead.
    distribution: { '@type': 'DataDownload', encodingFormat: 'XTide TCD', contentUrl: d.download },
  }
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
