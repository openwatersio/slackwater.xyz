import { useEffect, useState } from 'react'

/**
 * The moment every server render freezes at: the build clock.
 *
 * `__BUILD_NOW__` is one ISO timestamp injected by Vite's `define` (see
 * vite.config.ts), so the server and client bundles read the same instant —
 * `new Date()` at module scope would evaluate separately in each, and the
 * difference is a hydration mismatch. The value is as old as the deploy, which
 * the nightly rebuild in .github/workflows/deploy.yml keeps under a day.
 * Module scope so its identity is stable across renders — it is read, never
 * mutated.
 */
export const SERVER_NOW = new Date(__BUILD_NOW__)

/**
 * The clock, and whether it is the real one yet.
 *
 * `live` is false for the server render and true only once the effect has
 * run on a hydrated client. Anything that claims the present — "next slack,
 * in 30m" — must be gated on it: in prerendered HTML that claim is made
 * against SERVER_NOW, so a reader without JS (an AI crawler, an unfurl
 * scraper) gets a live-sounding reading that is stale by however long ago
 * the site was built, and drifting further every day.
 */
export function useLiveNow(): { now: Date; live: boolean } {
  const [now, setNow] = useState<Date>()
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return { now: now ?? SERVER_NOW, live: now !== undefined }
}
