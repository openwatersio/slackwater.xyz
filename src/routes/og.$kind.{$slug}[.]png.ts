import { createFileRoute } from '@tanstack/react-router'
import { stationBySlug } from '#/lib/catalogue-server'
import { renderCard, stationKindFromUrl } from '#/lib/og-image'

// The canonical card: /og/<kind>/<slug>.png - matches the og:image the page
// route ships for its bare (non-instant) URL. Separate file from the instant
// route below because one route file can only match one URL shape.
//
// `{$slug}.png`, not `$slug.png`: the router only splits a param from a
// literal suffix in the same segment when the param is brace-wrapped - plain
// `$slug.png` parses as one param literally named "slug.png" that swallows
// the whole segment, `.png` included, and the lookup below then 404s on
// every request.
export const Route = createFileRoute('/og/$kind/{$slug}.png')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // A real 404 Response, not `throw notFound()`: that helper is for the
        // page-navigation flow, where the router catches it and renders a
        // NotFoundComponent. A server route handler is expected to return a
        // Response directly - thrown here, it gets serialised as a 200 with
        // an `{"isNotFound":true}` body instead of an actual 404 status,
        // verified against a real Worker.
        const kind = stationKindFromUrl(params.kind)
        if (!kind) return new Response(null, { status: 404 })
        const station = await stationBySlug({ data: { kind, slug: params.slug } })
        if (!station) return new Response(null, { status: 404 })
        // `live: true` - the card says "Current conditions", not a timestamp
        // that would go stale the moment this response is cached.
        const png = await renderCard(station, new Date(), true)
        return new Response(png, {
          headers: {
            'content-type': 'image/png',
            // Renders "now" and goes stale by the minute - no `immutable`, or
            // every future unfurl of this station would freeze on whatever
            // moment first populated a client's cache.
            'cache-control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
