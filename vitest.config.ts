import { defineConfig } from 'vitest/config'

// Deliberately not vite.config.ts: loading the TanStack Start and nitro plugins
// for a unit test spins up a Worker preview server that then won't shut down.
export default defineConfig({
  // `.wasm` is not in Vite's default asset list, so the OG card rasteriser's
  // `?inline` import of resvg's wasm binary fails import analysis without this.
  assetsInclude: ['**/*.wasm'],
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
})
