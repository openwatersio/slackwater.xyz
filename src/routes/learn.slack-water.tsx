import { createFileRoute } from '@tanstack/react-router'
import { SlackWaterGuide, TITLE } from '#/components/SlackWaterGuide'
import { slackGuideData } from '#/lib/catalogue-server'

const CANONICAL = 'https://slackwater.xyz/learn/slack-water/'
const DESCRIPTION =
  'Slack water is the window around the turn of a tidal current, when the stream is weak enough to work with. Why it is not high or low tide, how long it lasts, and when to go.'
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': 'https://openwaters.io/#organization',
  name: 'Open Waters',
  url: 'https://openwaters.io/',
}

export const Route = createFileRoute('/learn/slack-water')({
  loader: () => slackGuideData(),
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { title: `${TITLE} · Slackwater` },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: CANONICAL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: TITLE,
          description: DESCRIPTION,
          url: CANONICAL,
          mainEntityOfPage: CANONICAL,
          image: 'https://slackwater.xyz/og.png',
          datePublished: '2026-10-14',
          inLanguage: 'en',
          // Spelled out rather than referenced by `@id`: the Organization node
          // lives in the home page's graph, and Google reads `author` per page.
          author: ORGANIZATION,
          publisher: ORGANIZATION,
          about: { '@type': 'Thing', name: 'Slack water' },
        },
      },
    ],
  }),
  component: () => <SlackWaterGuide guide={Route.useLoaderData()} />,
})
