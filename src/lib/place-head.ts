import type { PlaceIndex } from './catalogue-server'
import type { Kind } from './station'

const ORIGIN = 'https://slackwater.xyz'

/**
 * The head of a browse page, shared by the kind's index and every place
 * under it because they differ only in how deep the path runs.
 *
 * Place first, and never after a preposition: "Tide stations in United
 * States" wants an article that the data cannot supply — "the Netherlands",
 * "the Bahamas" take one. Leading with the name is also the order a searcher
 * types it in.
 */
export function placeHead(kind: Kind, page: PlaceIndex, path: string) {
  const what = kind === 'tide' ? 'tide stations' : 'tidal current stations'
  const title = page.name
    ? `${page.name} ${what} — Slackwater`
    : `${kind === 'tide' ? 'Tide' : 'Current'} stations — Slackwater`
  const description = page.name
    ? `${page.name}: ${page.count.toLocaleString()} ${what}, with times and charts for each.`
    : `Every ${kind === 'tide' ? 'tide' : 'tidal current'} station Slackwater predicts, by country.`
  const canonical = ORIGIN + path
  return {
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
    ],
  }
}
