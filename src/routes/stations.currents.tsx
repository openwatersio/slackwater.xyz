import { createFileRoute } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { stationList } from '#/lib/catalogue-server'

const CANONICAL = 'https://slackwater.xyz/stations/currents/'

export const Route = createFileRoute('/stations/currents')({
  loader: async () => ({ rows: await stationList({ data: { kind: 'current' } }) }),
  head: () => {
    const title = 'Current stations — Slackwater'
    const description = 'Every tidal current station Slackwater predicts, across the US and Canada.'
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
  component: () => <StationIndex kind="current" rows={Route.useLoaderData().rows} />,
})
