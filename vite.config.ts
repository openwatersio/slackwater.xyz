import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { loadCatalogue } from './src/lib/catalogue'

const stationPages = loadCatalogue().map((s) => ({
  path: `/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/`,
}))

// Deploy target is a Cloudflare Worker; the preset comes from NITRO_PRESET in the
// build script rather than inline config, so it stays put across nitro betas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  // `.wasm` is not in Vite's default asset list, so the OG card rasteriser's
  // `?inline` import of resvg's wasm binary fails import analysis without this.
  assetsInclude: ['**/*.wasm'],
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
        // Parameterised routes are excluded from discovery and this design has
        // no links between stations, so without `pages` above the build emits
        // zero station pages and still reports success.
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
