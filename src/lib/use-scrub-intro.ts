import { useEffect, useMemo, useState } from 'react'
import { INTRO_DURATION_SECONDS, introTime, introWindow } from './scrub'
import type { Station } from './station'

/**
 * Plays the night-to-morning scrub once, then stops.
 *
 * The loop genuinely ends: at rest the sun is up, so no star is drawn and there
 * is nothing left to twinkle. Reduced motion lands on the rest frame without
 * starting it at all.
 *
 * Every decision this makes lives in `scrub.ts`; what is here is the rAF loop.
 */
export function useScrubIntro(station: Station, now: Date, live: boolean) {
  // Keyed on the hour, not the clock: `useLiveNow` hands over a fresh `now`
  // every minute, and the nearest sunrise cannot move within an hour. Keying on
  // `now` would re-run two Almanac event searches a minute — and hand `skyDays`
  // fresh Date identities, re-running two more.
  const hour = Math.floor(now.getTime() / 3600_000)
  const { from, to } = useMemo(() => introWindow(station, now), [station, hour])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!live) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(INTRO_DURATION_SECONDS)
      return
    }
    let frame = 0
    const started = performance.now()
    const tick = (at: number) => {
      const seconds = (at - started) / 1000
      setElapsed(seconds)
      if (seconds < INTRO_DURATION_SECONDS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [live, from.getTime(), to.getTime()])

  return { from, to, seconds: elapsed, scrubTime: introTime(from, to, elapsed) }
}
