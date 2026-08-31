import { configDefaults, defineConfig } from 'vitest/config'
import { existsSync } from 'node:fs'

// Deliberately not vite.config.ts: loading the TanStack Start and nitro plugins
// for a unit test spins up a Worker preview server that then won't shut down.

/**
 * Three suites assert against real artifacts rather than mocks: the prerendered
 * pages under `.output/public`, the client bundle, and `src/routeTree.gen.ts`,
 * which is generated and git-ignored. None of it exists on a fresh clone, so
 * `pnpm test` failed there with three errors that read like a broken checkout.
 *
 * Skip them when the artifacts are absent so a clean clone gets a meaningful
 * run, and hard-fail instead under CI, where absence means the workflow ran the
 * tests before the build. That ordering is exactly what left the apex
 * undeployed after the station-pages merge, and a silent skip would have turned
 * that loud failure into a green run that tested nothing.
 *
 * Building here instead was tried and rejected: a `vite build` driven from
 * vitest's globalSetup hangs - the prerender's Worker preview server comes up
 * and never produces a page.
 */
const NEEDS_BUILD = [
  'src/lib/bundle-size.test.ts',
  'src/routes/station-routes.test.ts',
  'src/routes/instant-page.test.tsx',
]
const BUILT = existsSync('.output/public') && existsSync('src/routeTree.gen.ts')

if (!BUILT && process.env.CI) {
  throw new Error(
    'Build artifacts missing under CI. The workflow must run `pnpm build` before `pnpm test`.',
  )
}
if (!BUILT) {
  console.warn(`[vitest] no build artifacts - skipping ${NEEDS_BUILD.length} suites. \`pnpm build\` to include them.`)
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, ...(BUILT ? [] : NEEDS_BUILD)],
  },
})
