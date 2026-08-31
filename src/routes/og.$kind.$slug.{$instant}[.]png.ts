import { createFileRoute } from '@tanstack/react-router'
import { stationBySlug } from '#/lib/catalogue-server'
import { renderCard, stationKindFromUrl } from '#/lib/og-image'
import { parseInstant } from './instant-url'

// The instant card: /og/<kind>/<slug>/<instant>.png - matches the og:image
// the instant page route ships. Separate file from the bare route above
// because one route file can only match one URL shape.
//
// `{$instant}.png`, not `$instant.png`: see the sibling bare-card route for
// why - the router only splits a param from a literal suffix in the same
// segment when the param is brace-wrapped.
export const Route = createFileRoute('/og/$kind/$slug/{$instant}.png')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // A real 404 Response, not `throw notFound()` - see the sibling
        // bare-card route for why.
        const kind = stationKindFromUrl(params.kind)
        if (!kind) return new Response(null, { status: 404 })
        const station = await stationBySlug({ data: { kind, slug: params.slug } })
        if (!station) return new Response(null, { status: 404 })
        // A malformed instant must 404, never fall back to "now": that would
        // show the receiver different water from the one that was shared -
        // same reasoning as the page route this card illustrates.
        const instant = parseInstant(params.instant)
        if (!instant) return new Response(null, { status: 404 })
        const png = await renderCard(station, instant)
        return new Response(png, {
          headers: {
            'content-type': 'image/png',
            // A station at a given instant can never change - immutable is
            // correct here and would be wrong on the bare route above.
            'cache-control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
