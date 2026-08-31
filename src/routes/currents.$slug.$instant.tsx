import { createFileRoute, notFound } from '@tanstack/react-router'
import { CurrentCurve } from '#/components/CurrentCurve'
import { stationBySlug } from '#/lib/catalogue-server'
import { parseInstant } from './instant-url'

const CANONICAL = 'https://slackwater.xyz/currents/'

export const Route = createFileRoute('/currents/$slug/$instant')({
  loader: async ({ params }) => {
    // stationBySlug lives behind the server boundary (see below). The loader
    // returns ONE station, which is what gets serialised into the page.
    const station = await stationBySlug({ data: { kind: 'current', slug: params.slug } })
    if (!station) throw notFound()
    // A malformed instant must 404, never fall back to "now": that would show
    // the receiver different water from the one that was actually shared.
    const instant = parseInstant(params.instant)
    if (!instant) throw notFound()
    return { station, instant }
  },
  head: ({ loaderData, params }) => {
    const s = loaderData?.station
    if (!s) return {}
    const title = `${s.name} — tidal currents`
    const description = `Slack water and maximum flood and ebb for ${s.name}, computed from harmonic constituents.`
    return {
      // Points at the bare station URL, not this instant URL: the instant
      // space is unbounded, so treating each shared moment as its own
      // canonical page would turn every link into an indexable near-duplicate.
      links: [{ rel: 'canonical', href: `${CANONICAL}${s.slug}/` }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: `${CANONICAL}${s.slug}/${params.instant}` },
        {
          property: 'og:image',
          content: `https://slackwater.xyz/og/currents/${s.slug}/${params.instant}.png`,
        },
      ],
    }
  },
  component: CurrentInstant,
})

function CurrentInstant() {
  const { station, instant } = Route.useLoaderData()
  const start = new Date(instant.getTime() - 6 * 3600_000)
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{station.region}</p>
      <CurrentCurve station={station} start={start} hours={24} now={instant} />
    </main>
  )
}
