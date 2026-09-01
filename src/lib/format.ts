/**
 * The numbers and times a reader actually reads, formatted in one place.
 *
 * Times are in the station's own zone, never the runtime's: the Worker renders
 * in UTC and a reader's browser renders in their own zone. Both are the wrong
 * water clock — a gate transit happens on local time.
 */

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
