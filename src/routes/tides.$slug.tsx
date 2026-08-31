import { createFileRoute, notFound } from '@tanstack/react-router'
import { StationPage } from '#/components/StationPage'
import { nearbyStations, stationBySlug } from '#/lib/catalogue-server'
import { ogImageAlt, pageDescription } from '#/lib/copy'
import { useLiveNow } from '#/lib/use-live-now'

const CANONICAL = 'https://slackwater.xyz/tides/'

export const Route = createFileRoute('/tides/$slug')({
  loader: async ({ params }) => {
    // stationBySlug lives behind the server boundary (see below). The loader
    // returns ONE station, which is what gets serialised into the page.
    const station = await stationBySlug({ data: { kind: 'tide', slug: params.slug } })
    if (!station) throw notFound()
    const nearby = await nearbyStations({ data: { kind: 'tide', slug: params.slug } })
    return { station, nearby }
  },
  head: ({ loaderData }) => {
    const s = loaderData?.station
    if (!s) return {}
    const title = `${s.name} — tide heights`
    const description = pageDescription(s)
    const alt = ogImageAlt(s)
    return {
      links: [{ rel: 'canonical', href: `${CANONICAL}${s.slug}/` }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: `${CANONICAL}${s.slug}/` },
        { property: 'og:image', content: `https://slackwater.xyz/og/tides/${s.slug}.png` },
        // Overrides the site default only where it would be false — see `ogImageAlt`.
        ...(alt ? [{ property: 'og:image:alt', content: alt }] : []),
      ],
    }
  },
  component: TideStation,
})

function TideStation() {
  const { station, nearby } = Route.useLoaderData()
  const { now, live } = useLiveNow()
  return <StationPage station={station} now={now} live={live} nearby={nearby} />
}
