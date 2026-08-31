/**
 * Time formatting, in the station's own zone.
 *
 * Always the station's zone, never the runtime's: the Worker renders in UTC
 * and a reader's browser renders in their own zone. Both are the wrong water
 * clock — a gate transit happens on local time.
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
