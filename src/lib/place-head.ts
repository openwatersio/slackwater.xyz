import type { PlaceIndex } from './catalogue-server'
import { placeJsonLd } from './json-ld'
import type { Kind } from './station'

const ORIGIN = 'https://slackwater.xyz'

const stations = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'station' : 'stations'}`

/** What a searcher calls each kind's pages: the words the title leads with after the place. */
const WHAT: Record<Kind, string> = {
  tide: 'tide tables and tide charts',
  current: 'tidal currents and slack water',
}

/**
 * The head of a browse page, shared by the kind's index and every place
 * under it because they differ only in how deep the path runs.
 *
 * Place first, spelled out, and never after a preposition: a searcher types
 * "Washington tide tables", not "WA tide stations", and "Tide stations in
 * United States" wants an article the data cannot supply — "the Netherlands",
 * "the Bahamas" take one. The title carries the short name; the description
 * carries the country too, because "Georgia" alone is two places.
 */
export function placeHead(kind: Kind, page: PlaceIndex, path: string) {
  const title = page.name
    ? `${page.name} ${WHAT[kind]} — ${stations(page.count)}`
    : kind === 'tide'
      ? `Tide tables and tide charts worldwide — ${stations(page.count)}`
      : `Tidal currents and slack water in the United States and Canada — ${stations(page.count)}`
  const other = page.other
    ? ` ${kind === 'tide' ? 'Tidal currents' : 'Tide tables'} too, at ${stations(page.other.count)}.`
    : ''
  const description = page.name
    ? `${page.title}: ${kind === 'tide' ? 'tide times and charts' : 'tidal current predictions and slack water times'} for ${stations(page.count)}.${other}`
    : `Every ${kind === 'tide' ? 'tide' : 'tidal current'} station Slackwater predicts, by country.`
  const canonical = ORIGIN + path
  const links = [
    ...page.places.map((p) => ({ href: p.href, name: p.name })),
    ...page.rows.map((r) => ({ href: r.path, name: r.name })),
  ]
  const root = kind === 'tide' ? 'Tide stations' : 'Current stations'
  return {
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
    ],
    scripts: placeJsonLd({ title: page.title ?? root, name: page.name ?? root, crumbs: page.crumbs, links }, canonical).map((json) => ({
      type: 'application/ld+json',
      children: JSON.stringify(json),
    })),
  }
}
