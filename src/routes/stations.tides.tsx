import { createFileRoute } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { stationList } from '#/lib/catalogue-server'

const CANONICAL = 'https://slackwater.xyz/stations/tides/'

export const Route = createFileRoute('/stations/tides')({
  loader: async () => ({ rows: await stationList({ data: { kind: 'tide' } }) }),
  head: () => {
    const title = 'Tide stations — Slackwater'
    const description = 'Every tide station Slackwater predicts, worldwide.'
    return {
      links: [{ rel: 'canonical', href: CANONICAL }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: CANONICAL },
      ],
    }
  },
  component: () => <StationIndex kind="tide" rows={Route.useLoaderData().rows} />,
})
