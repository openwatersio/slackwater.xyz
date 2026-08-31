import { createFileRoute } from '@tanstack/react-router'

/**
 * The one value that changes if the app's signing identity does:
 * `<Apple Team ID>.<bundle identifier>`.
 *
 * Both halves come from the iOS project — the team from `DEVELOPMENT_TEAM`,
 * the bundle from `PRODUCT_BUNDLE_IDENTIFIER` on the app target (not the
 * widget extension, which is a separate identifier and must not be listed
 * here: it has no UI to open a link with).
 */
const APP_ID = 'R3H8DPTV9C.org.openwaters.slackwater'

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
 * `/tides/*` and `/currents/*` also cover the timestamped form, because the
 * instant is a further path segment (`/currents/<slug>/<instant>`) and `*`
 * matches across `/`. Two patterns, four URL shapes. See
 * `docs/superpowers/specs/2026-08-30-station-pages-design.md` for the URL
 * design itself.
 *
 * ## Gotchas that cost time
 *
 * - **Return a `Response`, never `notFound()`.** A thrown `notFound()`
 *   serialises as a 200 carrying `{"isNotFound":true}`, which Apple would
 *   happily parse as a malformed association file.
 * - **`application/json`, and no `.json` on the path.** Apple requires both.
 *   The `[.]` in this file's name is the escape for a literal dot, so the
 *   route is `/.well-known/apple-app-site-association` exactly.
 * - **`pnpm dev` will 404 this.** It is a Worker-owned route; check it with
 *   `pnpm build && npx wrangler dev -c .output/server/wrangler.json`.
 *
 * Apple fetches this through its own CDN and caches it, so a change here is
 * not picked up instantly by devices in the field.
 */
const association = {
  applinks: {
    details: [
      {
        appIDs: [APP_ID],
        components: [
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
