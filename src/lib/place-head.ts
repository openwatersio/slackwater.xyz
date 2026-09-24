import type { PlaceIndex } from './catalogue-server'
import type { Kind } from './station'

const ORIGIN = 'https://slackwater.xyz'

/**
 * The head of a place page, shared by the country and subdivision routes
 * because the two differ only in how deep the path runs.
 *
 * Place first, and never after a preposition: "Tide stations in United
 * States" wants an article that the data cannot supply — the tide database
 * names 118 countries and a handful of them ("the Netherlands", "the
 * Bahamas") take one. Leading with the name is also the order a searcher
 * types it in.
 */
export function placeHead(kind: Kind, page: PlaceIndex | undefined, path: string) {
  if (!page?.name) return {}
  const what = kind === 'tide' ? 'tide stations' : 'tidal current stations'
  const title = `${page.name} ${what} — Slackwater`
  const description = `${page.name}: ${page.count.toLocaleString()} ${what}, with times and charts for each.`
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
