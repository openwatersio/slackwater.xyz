import { useEffect, useState } from 'react'

/**
 * The moment every server render freezes at.
 *
 * A literal, not `new Date()`: the latter would bake build time into all
 * 3,607 prerendered pages AND differ between server and client, which is a
 * hydration mismatch. Module scope so its identity is stable across renders —
 * it is read, never mutated.
 */
const SERVER_NOW = new Date('2026-08-21T12:00:00Z')

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
