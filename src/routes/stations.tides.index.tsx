import { createFileRoute } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { placeIndex } from '#/lib/catalogue-server'

const CANONICAL = 'https://slackwater.xyz/stations/tides/'

export const Route = createFileRoute('/stations/tides/')({
  loader: async () => (await placeIndex({ data: { kind: 'tide' } }))!,
  head: () => {
    const title = 'Tide stations — Slackwater'
    const description = 'Every tide station Slackwater predicts, by country.'
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
  component: Tides,
})

function Tides() {
  const { places, rows, count } = Route.useLoaderData()
  return (
    <StationIndex
      kind="tide"
      places={places}
      rows={rows}
      lede={`${count.toLocaleString()} stations across ${places.length} countries.`}
    />
  )
}
