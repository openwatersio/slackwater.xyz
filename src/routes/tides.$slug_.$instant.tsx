import { createFileRoute, notFound } from '@tanstack/react-router'
import { StationPage } from '#/components/StationPage'
import { stationBySlug } from '#/lib/catalogue-server'
import { parseInstant } from './instant-url'

const CANONICAL = 'https://slackwater.xyz/tides/'

// `$slug_`, with the trailing underscore, and NOT `$slug`.
//
// Flat file routing nests by filename: `tides.$slug.$instant.tsx` makes this
// route a CHILD of `tides.$slug.tsx`, whose component renders no <Outlet/>.
// The child's loader still runs — so the 404s, the canonical and the og:image
// were all correct — but its component never mounts, and every instant URL
// rendered the parent page frozen at its build-time clock. A shared link
// unfurled the right hour and landed on a different one. The underscore opts
// this route out of nesting (the URL is unchanged: `/tides/<slug>/<instant>`),
// which is the router's own convention for a route that shares a path prefix
// but not a layout. `src/routes/instant-page.test.tsx` is the guard.
export const Route = createFileRoute('/tides/$slug_/$instant')({
  loader: async ({ params }) => {
    // stationBySlug lives behind the server boundary (see below). The loader
    // returns ONE station, which is what gets serialised into the page.
    const station = await stationBySlug({ data: { kind: 'tide', slug: params.slug } })
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
    const title = `${s.name} — tide heights`
    const description = `Tide heights and the next high and low for ${s.name}, computed from harmonic constituents.`
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
          content: `https://slackwater.xyz/og/tides/${s.slug}/${params.instant}.png`,
        },
      ],
    }
  },
  component: TideInstant,
})

function TideInstant() {
  const { station, instant } = Route.useLoaderData()
  // Never `live`: this page is one fixed shared moment, so a relative "in 30m"
  // would be measured from a moment that may be long past.
  return <StationPage station={station} now={instant} />
}
