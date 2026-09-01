import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { loadCatalogue } from './src/lib/catalogue'
import { buildSitemaps } from './src/lib/sitemap'

const catalogue = loadCatalogue()

const stationPages = catalogue.map((s) => ({
  path: `/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/`,
}))

// Written straight into public/ so Vite's static copy ships them as
// .output/public/sitemap*.xml — same mechanism as the old hand-written file.
for (const [name, xml] of Object.entries(buildSitemaps(catalogue))) {
  writeFileSync(`./public/${name}`, xml)
}

// The prerender crawl runs against `wrangler dev`, and wrangler dev watches its
// assets directory — which is .output/public, the directory the crawl is writing
// 3,630 pages into. Every batch of writes restarted the server mid-crawl (~110
// restarts a build), and a request in flight across a restart either lost its
// socket, taking the whole build down on an unhandled ECONNRESET, or came back
// empty and got written out as an empty page that every check then passed.
// Pointing the crawl's server at a directory nothing writes to leaves the
// watcher nothing to see. The crawl wants SSR for every route anyway: with
// .output/public mounted, a rebuild served the previous build's HTML straight
// back to the crawler instead of re-rendering it. Deploys are unaffected —
// .output/server/wrangler.json still mounts the real assets. See issue #48.
const PRERENDER_ASSETS = './.wrangler/prerender-assets'
mkdirSync(PRERENDER_ASSETS, { recursive: true })

// Deploy target is a Cloudflare Worker; the preset comes from NITRO_PRESET in the
// build script rather than inline config, so it stays put across nitro betas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // `pages` is a top-level option, a sibling of `prerender` — not nested
      // inside it. The installed plugin's schema (tanstackStartOptionsObjectSchema
      // in @tanstack/start-plugin-core) validates `prerender` against a schema
      // with no `pages` field, so nesting it there is silently dropped and the
      // build still reports success while emitting zero station pages.
      pages: stationPages,
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        // Parameterised routes are excluded from discovery, so without `pages`
        // above the build emits zero station pages and still reports success.
        // The browse index links to every station and would now let crawlLinks
        // find them, but `pages` stays: discovery via one page is a single point
        // of failure for the whole corpus.
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
        concurrency: 14,
      },
    }),
    // Plausible served first-party: ad blockers list plausible.io by domain, so a
    // third-party snippet loses a chunk of visitors. These two rules make the script
    // and the event endpoint same-origin. Cookies are stripped on the way out (per
    // Plausible's proxy guide); every other header — including the CF-set
    // X-Forwarded-For that Plausible reads for unique-visitor counting — passes through.
    // Only resolves in a real Worker: vite dev claims `.js` URLs before these rules run.
    nitro({
      commands: { preview: `npx wrangler --cwd ./ dev --assets ${PRERENDER_ASSETS}` },
      routeRules: {
        '/js/script.js': { proxy: 'https://plausible.io/js/script.outbound-links.js' },
        '/api/event': {
          proxy: { to: 'https://plausible.io/api/event', filterHeaders: ['cookie'] },
        },
      },
    }),
    viteReact(),
  ],
})
