// Not a route: the head the hub and the state pages share.
import { situationHead } from '#/components/SituationPage'
import { articleJsonLd } from '#/lib/json-ld'
import type { KingTidePage } from '#/lib/king-tides'

export function kingTidesHead(page: KingTidePage | undefined) {
  if (!page) return {}
  const { links, meta } = situationHead(page)
  const article = articleJsonLd({
    headline: page.heading,
    description: page.description,
    url: `https://slackwater.xyz${page.path}`,
    datePublished: '2026-11-22',
    dateModified: __LASTMOD__[page.path],
    about: 'King tide',
  })
  return {
    links,
    meta: [...meta, { property: 'og:type', content: 'article' }],
    scripts: [{ type: 'application/ld+json', children: JSON.stringify(article) }],
  }
}
