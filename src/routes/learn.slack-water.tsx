import { createFileRoute } from '@tanstack/react-router'
import { SlackWaterGuide, TITLE } from '#/components/SlackWaterGuide'
import { slackGuideData } from '#/lib/catalogue-server'
import { articleJsonLd } from '#/lib/json-ld'

const CANONICAL = 'https://slackwater.xyz/learn/slack-water/'
const DESCRIPTION =
  'Slack water is the window around the turn of a tidal current, when the stream is weak enough to work with. Why it is not high or low tide, how long it lasts, and when to go.'

export const Route = createFileRoute('/learn/slack-water')({
  loader: () => slackGuideData(),
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/learn/slack-water.md' }],
    meta: [
      { title: `${TITLE} · Slackwater` },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: CANONICAL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      {
        'script:ld+json': articleJsonLd({
          headline: TITLE,
          description: DESCRIPTION,
          url: CANONICAL,
          datePublished: '2026-10-14',
          about: 'Slack water',
        }),
      },
    ],
  }),
  component: () => <SlackWaterGuide guide={Route.useLoaderData()} />,
})
