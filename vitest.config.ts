import { defineConfig } from 'vitest/config'

// Deliberately not vite.config.ts: loading the TanStack Start and nitro plugins
// for a unit test spins up a Worker preview server that then won't shut down.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
})
