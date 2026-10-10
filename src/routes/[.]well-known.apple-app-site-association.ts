import { createFileRoute } from '@tanstack/react-router'

/**
 * The apps allowed to open a station link, as `<Apple Team ID>.<bundle id>`.
 *
 * Both halves come from the iOS project — the team from `DEVELOPMENT_TEAM`,
 * the bundle from `PRODUCT_BUNDLE_IDENTIFIER` on the app target. The widget
 * extension is a separate identifier and is deliberately absent: it has no UI
 * to open a link with.
 *
 * **Two entries, on purpose.** The app's identifiers moved from the
 * `org.openwaters` prefix to `io.openwaters`, under a different team. A bundle
 * id is permanent once registered, so that was a new app record rather than a
 * rename, and both exist on real devices for now — a build installed before
 * the move keeps working, and testers cross over by installing the new one. An
 * association file may list several app ids for the same paths, so listing
 * both is what keeps links working on both sides of that change instead of
 * breaking one of them for as long as Apple's CDN caches this.
 */
const APP_IDS = [
  // Current, shipping.
  'Z59BQLF5VQ.io.openwaters.slackwater',
  // Outgoing — builds installed before the move. Retire this once no device
  // runs one.
  'R3H8DPTV9C.org.openwaters.slackwater',
]

/**
 * Apple App Site Association — the file that lets iOS open a station link in
 * the app instead of the browser.
 *
 * ## Why the paths are narrow
 *
 * A universal link claims URLs *away* from this site: a tap on a claimed path
 * opens the app and never renders the page. So this claims station paths only.
 * Claiming `/` would mean someone tapping a link to the landing page gets the
 * app if they have it — and the pitch never gets read by the one person most
 * likely to share it onward.
 *
 * The app opens the short share form it mints itself, `/tides/<slug>` and
 * `/tides/<slug>/<instant>`, and parses nothing longer. The site's own pages
 * sit under a country (`/tides/us/pa/<slug>/`), so those are excluded and
 * open here: claimed, they would open the app to nothing. A country code is
 * two letters and a slug never is, so `??` tells the two apart. `*` matches
 * across `/`, which is why one `/tides/*` claims both share forms. Rules are
 * read in order, first match wins.
 *
 * ## Gotchas that cost time
 *
 * - **Return a `Response`, never `notFound()`.** A thrown `notFound()`
 *   serialises as a 200 carrying `{"isNotFound":true}`, which Apple would
 *   happily parse as a malformed association file.
 * - **`application/json`, and no `.json` on the path.** Apple requires both.
 *   The `[.]` in this file's name is the escape for a literal dot, so the
 *   route is `/.well-known/apple-app-site-association` exactly.
 * - **`npm run dev` will 404 this.** It is a Worker-owned route; check it with
 *   `npm run build && npx wrangler dev -c .output/server/wrangler.json`.
 *
 * Apple fetches this through its own CDN and caches it, so a change here is
 * not picked up instantly by devices in the field.
 */
const association = {
  applinks: {
    details: [
      {
        appIDs: APP_IDS,
        components: [
          ...(['tides', 'currents'] as const).flatMap((kind) => [
            { '/': `/${kind}/`, exclude: true, comment: 'The index, a browse page' },
            { '/': `/${kind}/??`, exclude: true, comment: 'A country, a browse page' },
            { '/': `/${kind}/??/*`, exclude: true, comment: 'Anything under a country' },
          ]),
          { '/': '/tides/*', comment: 'A tide station, with or without an instant' },
          { '/': '/currents/*', comment: 'A current station, with or without an instant' },
        ],
      },
    ],
  },
}

export const Route = createFileRoute('/.well-known/apple-app-site-association')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(association), {
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  },
})
