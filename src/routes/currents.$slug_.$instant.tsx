import { createFileRoute, notFound } from '@tanstack/react-router'
import { StationPage } from '#/components/StationPage'
import { nearbyStations, stationBySlug } from '#/lib/catalogue-server'
import { ogImageAlt, pageDescription, pageTitle } from '#/lib/copy'
import { stationPath } from '#/lib/station'
import { useLiveNow } from '#/lib/use-live-now'
import { parseInstant } from './instant-url'

const ORIGIN = 'https://slackwater.xyz'
const canonical = (slug: string) => ORIGIN + stationPath('current', slug)

// `$slug_`, with the trailing underscore, and NOT `$slug`.
//
// Flat file routing nests by filename: `currents.$slug.$instant.tsx` makes this
// route a CHILD of `currents.$slug.tsx`, whose component renders no <Outlet/>.
// The child's loader still runs — so the 404s, the canonical and the og:image
// were all correct — but its component never mounts, and every instant URL
// rendered the parent page frozen at its build-time clock. A shared link
// unfurled the right hour and landed on a different one. The underscore opts
// this route out of nesting (the URL is unchanged: `/currents/<slug>/<instant>`),
// which is the router's own convention for a route that shares a path prefix
// but not a layout. `src/routes/instant-page.test.tsx` is the guard.
export const Route = createFileRoute('/currents/$slug_/$instant')({
  loader: async ({ params }) => {
    // stationBySlug lives behind the server boundary (see below). The loader
    // returns ONE station, which is what gets serialised into the page.
    const station = await stationBySlug({ data: { kind: 'current', slug: params.slug } })
    if (!station) throw notFound()
    // A malformed instant must 404, never fall back to "now": that would show
    // the receiver different water from the one that was actually shared.
    const instant = parseInstant(params.instant)
    if (!instant) throw notFound()
    const nearby = await nearbyStations({ data: { kind: 'current', slug: params.slug } })
    return { station, instant, nearby }
  },
  head: ({ loaderData, params }) => {
    const s = loaderData?.station
    if (!s) return {}
    const title = pageTitle(s)
    const description = pageDescription(s)
    const alt = ogImageAlt(s)
    return {
      // Points at the bare station URL, not this instant URL: the instant
      // space is unbounded, so treating each shared moment as its own
      // canonical page would turn every link into an indexable near-duplicate.
      links: [{ rel: 'canonical', href: canonical(s.slug) }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: `${canonical(s.slug)}${params.instant}` },
        {
          property: 'og:image',
          content: `https://slackwater.xyz/og/currents/${s.slug}/${params.instant}.png`,
        },
        // Overrides the site default only where it would be false — see `ogImageAlt`.
        ...(alt ? [{ property: 'og:image:alt', content: alt }] : []),
      ],
    }
  },
  component: CurrentInstant,
})

function CurrentInstant() {
  const { station, instant, nearby } = Route.useLoaderData()
  const { now, live } = useLiveNow()
  // A bundled station keeps the shared selection while the real clock drives
  // its separate Now marker. CHS keeps its fetched fixed-day behavior.
  return station.source === 'bundled'
    ? <StationPage station={station} now={now} selectedAt={instant} live={live} nearby={nearby} />
    : <StationPage station={station} now={instant} settled nearby={nearby} />
}
