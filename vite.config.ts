import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Deploy target is a Cloudflare Worker; the preset comes from NITRO_PRESET in the
// build script rather than inline config, so it stays put across nitro betas.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
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
