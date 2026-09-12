/**
 * The numbers and times a reader actually reads, formatted in one place.
 *
 * Times are in the station's own zone, never the runtime's: the Worker renders
 * in UTC and a reader's browser renders in their own zone. Both are the wrong
 * water clock — a gate transit happens on local time.
 */

/**
 * The site speaks feet; every provider we read publishes metres.
 *
 * Lives here rather than in `catalogue.ts` because there are two boundaries
 * now, not one. The bundled corpus converts at build time; `iwls.ts` converts
 * DFO's tide heights in the reader's browser, and it may not import the
 * catalogue — `bundle-size.test.ts` fences that off. One constant, so the two
 * paths cannot come to disagree about how long a metre is.
 */
export const FEET_PER_METRE = 3.28084

/** "20:40" */
export function hhmm(d: Date, timeZone: string): string {
  return d.toLocaleTimeString('en-CA', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * "Sun 30 Aug 2026".
 *
 * The year is not decoration: a shared instant can be any date, and a page
 * showing bare `hh:mm` leaves the receiver unable to tell which day — or
 * which year — the water they are looking at belongs to.
 */
export function dayLabel(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('year')}`
}

/**
 * A height, one decimal, in whatever unit the caller labels it with — and
 * never "-0.0".
 *
 * `toFixed(1)` reports a value between -0.05 and 0 faithfully as "-0.0", which
 * is a true number and a false label: there is no reading of the water where
 * the tide is negative zero feet. The strip happens after `toFixed`, not as a
 * threshold before it, so this can never disagree with `toFixed`'s own
 * rounding about where the boundary is.
 *
 * A real negative is left alone. A station whose whole curve sits below datum
 * has a negative high, and that is a datum question, not a formatting one.
 *
 * The currents path escapes this by accident — both call sites wrap in
 * `Math.abs()` because a speed has no sign — which is why this bug was
 * tide-only.
 */
export function height(n: number): string {
  const s = n.toFixed(1)
  return s === '-0.0' ? '0.0' : s
}

/**
 * "7:42am" — the app's `chartTime`, which pins `en_US_POSIX` so it is always
 * twelve-hour. Deliberately not `hhmm`: this is the reading the app's lead card
 * shows, and it reads the way the app reads it.
 */
export function chartTime(d: Date, timeZone: string): string {
  return d
    .toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    // Newer ICU separates the meridiem with U+202F, which `\s` matches and a literal space does not.
    .replace(/\s/g, '')
    .toLowerCase()
}

const POINTS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

/** The sixteen-point name for a bearing — `compass16` in the app. */
export function compass16(deg: number): string {
  const d = ((deg % 360) + 360) % 360
  return POINTS_16[Math.round(d / 22.5) % 16]
}

/**
 * What the wall clock in `timeZone` reads at instant `t`, minus UTC, in ms.
 *
 * `Intl` will not hand out a zone's offset as a number, so this reads the
 * formatted wall clock back through `Date.UTC` and takes the difference. That
 * also makes it right for zones on a half or quarter hour, which a table of
 * whole hours would not be.
 */
function zoneOffsetMs(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - t
  )
}

/**
 * The instant midnight begins in the station's own zone, `offsetDays` days on.
 *
 * The offset is applied to the local calendar date, NOT as a multiple of 24
 * hours: on the day a zone springs forward the next midnight is 23 hours away,
 * and every window built by adding 86,400,000 ms lands an hour into the wrong
 * day for the rest of the season.
 */
export function dayStart(d: Date, timeZone: string, offsetDays = 0): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day') + offsetDays)
  // Two passes: the offset at the guess can differ from the offset at the
  // answer when a transition falls between them, and the second pass reads it
  // at an instant already inside the right side of the boundary.
  const guess = wall - zoneOffsetMs(wall, timeZone)
  return new Date(wall - zoneOffsetMs(guess, timeZone))
}

/** Move on the station's calendar without changing the selected wall-clock time. */
export function shiftLocalDay(d: Date, timeZone: string, offsetDays: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const wall = Date.UTC(
    get('year'), get('month') - 1, get('day') + offsetDays,
    get('hour'), get('minute'), get('second'), d.getMilliseconds(),
  )
  const guess = wall - zoneOffsetMs(wall, timeZone)
  const result = new Date(wall - zoneOffsetMs(guess, timeZone))
  const observedWall = result.getTime() + zoneOffsetMs(result.getTime(), timeZone)
  // A skipped spring-forward time has no exact instant. Carry it through the
  // gap (02:30 → 03:30) instead of silently moving the selection backward.
  return observedWall === wall ? result : new Date(result.getTime() + wall - observedWall)
}
