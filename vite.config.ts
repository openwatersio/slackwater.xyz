import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { loadCatalogue } from './src/lib/catalogue'
import { kindRoot, placeTree } from './src/lib/places'
import { buildSitemaps, STATIC_PATHS } from './src/lib/sitemap'
import { buildRedirects } from './src/lib/redirects'
import type { Kind } from './src/lib/station'

const BUILD_NOW = new Date().toISOString()
const catalogue = loadCatalogue()

const stationPages = catalogue.map((s) => ({ path: s.path }))
// Each kind's index and every country and subdivision under it. Parameterised
// like the station pages, so listed for the same reason — and derived from the
// same catalogue the routes read, so the list cannot disagree with what the
// pages link to.
const PLACE_PATHS = (['tide', 'current'] as Kind[]).flatMap((kind) => [
  kindRoot(kind),
  ...placeTree(catalogue.filter((s) => s.kind === kind)).keys(),
])
const placePages = PLACE_PATHS.map((path) => ({ path }))
// Comparison pages are parameterised routes too, so they need listing here for
// the same reason the stations do. `src/lib/compare.ts` parses the same
// frontmatter with import.meta.glob, which does not exist in this file's Node
// context; reading the one `url:` line here is the whole duplication.
const COMPARE_DIR = './src/content/compare'
const COMPARE_SOURCES = new Map(
  readdirSync(COMPARE_DIR).map((f) => {
    const file = `${COMPARE_DIR}/${f}`
    return [new URL(readFileSync(file, 'utf8').match(/^url: (.+)$/m)![1]).pathname, file]
  }),
)
const COMPARE_PATHS = [...COMPARE_SOURCES.keys()]
const comparePages = COMPARE_PATHS.map((path) => ({ path }))

// A sitemap <lastmod> is only worth anything to a crawler while it is honest.
// Station pages print the day's predictions, so they really do change with
// every nightly build. Every other page changes when its source does, so it is
// dated by the last commit to touch that source. The deploy checkout fetches
// full history for this; a shallow clone would date every page to HEAD.
const BUILD_DATE = BUILD_NOW.slice(0, 10)
const PLACE_SOURCES = ['./src/routes/-directory.tsx', './package.json']
const PAGE_SOURCES: Record<string, string[]> = {
  '/': ['./src/routes/index.tsx'],
  '/pricing/': ['./src/routes/pricing.tsx', './src/content/pricing.md'],
  '/about/': ['./src/routes/about.tsx', './src/content/about.md'],
  '/contact/': ['./src/routes/contact.tsx', './src/content/contact.md'],
  '/support/': ['./src/routes/support.tsx', './src/content/support.md'],
  '/privacy/': ['./src/routes/privacy.tsx', './src/content/privacy.md'],
  '/accuracy/': ['./src/routes/accuracy.tsx', './src/content/accuracy.md'],
  '/opencpn/': ['./src/routes/opencpn.tsx', './src/content/opencpn.md'],
  '/kayak/': ['./src/routes/kayak.tsx', './src/content/kayak.md'],
  '/tide-pools/': ['./src/routes/tide-pools.tsx', './src/content/tide-pools.md'],
  '/learn/tides/': ['./src/routes/learn.tides.tsx'],
  '/learn/slack-water/': ['./src/routes/learn.slack-water.tsx', './src/lib/slack-guide.ts', './src/components/SlackTideChart.tsx'],
  '/stations/': ['./src/routes/stations.index.tsx'],
}
const STATION_PATHS = new Set(catalogue.map((s) => s.path))
const commitDate = (files: string[]) =>
  execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { encoding: 'utf8' }).trim() || BUILD_DATE
const lastmod = (path: string) => {
  if (STATION_PATHS.has(path)) return BUILD_DATE
  const sources = PAGE_SOURCES[path] ?? (COMPARE_SOURCES.has(path) ? [COMPARE_SOURCES.get(path)!] : PLACE_SOURCES)
  return commitDate(sources)
}

// Written straight into public/ so Vite's static copy ships them as
// .output/public/sitemap*.xml — same mechanism as the old hand-written file.
// The sitemaps are gitignored: station pages carry the build date, so every
// build rewrites them. _redirects has no dates and stays committed, because
// its diff is how a redirect change gets reviewed; preview.yml fails a PR
// whose build changes it.
for (const [name, xml] of Object.entries(buildSitemaps(catalogue, [...COMPARE_PATHS, ...PLACE_PATHS], lastmod))) {
  writeFileSync(`./public/${name}`, xml)
}
writeFileSync('./public/_redirects', buildRedirects(catalogue.map((s) => s.path), [...STATIC_PATHS, ...COMPARE_PATHS, ...PLACE_PATHS]))

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
  // One clock for the whole build, so the server and client bundles agree on it
  // and every prerendered page is dated the day it was built. Freshness comes
  // from the nightly rebuild in .github/workflows/deploy.yml.
  // The static pages' sitemap dates, for the structured data of the pages that
  // print no date of their own: one function, so the two cannot disagree.
  // The database's version is read here rather than imported by the page code:
  // the bundler ships the package's package.json in the same chunk as its
  // decoder, so importing it decoded every station at Worker startup (#242).
  define: {
    __BUILD_NOW__: JSON.stringify(BUILD_NOW),
    __LASTMOD__: JSON.stringify(Object.fromEntries(STATIC_PATHS.map((p) => [p, lastmod(p)]))),
    __DATABASE_VERSION__: JSON.stringify(createRequire(import.meta.url)('@slackwater/database/package.json').version),
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // `pages` is a top-level option, a sibling of `prerender` — not nested
      // inside it. The installed plugin's schema (tanstackStartOptionsObjectSchema
      // in @tanstack/start-plugin-core) validates `prerender` against a schema
      // with no `pages` field, so nesting it there is silently dropped and the
      // build still reports success while emitting zero station pages.
      pages: [
        ...stationPages,
        ...comparePages,
        ...placePages,
        // Markdown twins: prerendered so the Worker serves files rather than
        // recomputing the slack-water guide and station hub on request.
        ...['/index.md', '/opencpn.md', '/stations.md', '/learn/tides.md', '/learn/slack-water.md'].map((path) => ({ path })),
        ...COMPARE_PATHS.map((path) => ({ path: `${path.slice(0, -1)}.md` })),
      ],
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        // Parameterised routes are excluded from discovery, so without `pages`
        // above the build emits zero station pages and still reports success.
        // The browse index reaches every station through its country and
        // subdivision pages and would now let crawlLinks find them, but `pages`
        // stays: discovery through one chain of pages is a single point of
        // failure for the whole corpus.
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
      entry: fileURLToPath(new URL('./src/worker.ts', import.meta.url)),
      alias: {
        // Wrap the preset so negotiation runs before Nitro's own static-asset shortcut.
        '#cloudflare-handler': fileURLToPath(new URL('./dist/presets/cloudflare/runtime/cloudflare-module.mjs', import.meta.resolve('nitro/package.json'))),
      },
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
