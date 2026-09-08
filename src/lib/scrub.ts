import { sunEvents } from '@openwaters/almanac'
import type { Station } from './station'

/** Long enough for the star field to register before anything moves. */
export const INTRO_HOLD_SECONDS = 0.8
export const INTRO_SCRUB_SECONDS = 5
export const INTRO_DURATION_SECONDS = INTRO_HOLD_SECONDS + INTRO_SCRUB_SECONDS

const HOURS_BEFORE_SUNRISE = 4
const HOURS_AFTER_SUNRISE = 2
const DAY_MS = 24 * 3600_000

/**
 * The night-to-morning window the hero scrubs across.
 *
 * It rests after sunrise rather than at the present because half of all visits
 * would otherwise end in darkness. The sunrise is the one nearest `now`, which
 * needs no timezone arithmetic: within twelve hours either side there is
 * exactly one, and it is the station's own.
 */
export function introWindow(station: Station, now: Date): { from: Date; to: Date } {
  const rises = sunEvents(
    new Date(now.getTime() - DAY_MS),
    new Date(now.getTime() + DAY_MS),
    { latitudeDeg: station.latitude, longitudeDeg: station.longitude },
  ).filter((e) => e.kind === 'rise')

  const nearest = rises.reduce<Date | undefined>((best, e) => {
    if (!best) return e.time
    const closer = Math.abs(e.time.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())
    return closer ? e.time : best
  }, undefined)

  // ponytail: a polar station in its own summer or winter has no rise to find;
  // rest at `now` rather than invent one. Revisit if the hero ever moves north.
  const rest = nearest ?? now
  return {
    from: new Date(rest.getTime() - HOURS_BEFORE_SUNRISE * 3600_000),
    to: new Date(rest.getTime() + HOURS_AFTER_SUNRISE * 3600_000),
  }
}

/**
 * Held, then eased, then finished.
 *
 * The app's own `introTime` is linear because a scroll view supplies its
 * easing; this one is driven directly, so the smoothstep is here.
 */
export function introProgress(elapsedSeconds: number): number {
  const t = Math.min(1, Math.max(0, (elapsedSeconds - INTRO_HOLD_SECONDS) / INTRO_SCRUB_SECONDS))
  return t * t * (3 - 2 * t)
}

export function introTime(from: Date, to: Date, elapsedSeconds: number): Date {
  return new Date(from.getTime() + (to.getTime() - from.getTime()) * introProgress(elapsedSeconds))
}
