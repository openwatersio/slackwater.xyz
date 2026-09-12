/**
 * Parse the instant segment of a share URL.
 *
 * Returns undefined rather than throwing or defaulting to now: a malformed
 * instant means the link is wrong, and silently rendering the current moment
 * would show the receiver different water from the one that was shared.
 */
export function parseInstant(raw: string): Date | undefined {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/)
  if (!m) return undefined
  const [, year, month, day] = m
  // `new Date()` correctly rejects an out-of-range month or hour, but silently
  // normalizes an out-of-range day (Feb 30 -> Mar 2) instead of rejecting it —
  // so a mistyped day would serve a *different*, plausible-looking moment
  // instead of a 404. Round-tripping the numeric parts through Date.UTC and
  // checking the day survived reuses Date's own calendar/leap-year math
  // rather than hand-rolling one.
  const check = new Date(Date.UTC(+year, +month - 1, +day))
  if (check.getUTCMonth() !== +month - 1 || check.getUTCDate() !== +day) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** A minute-precise instant written in the station's own UTC offset. */
export function formatInstant(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const offset = get('timeZoneName').replace('GMT', '') || 'Z'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}${offset}`
}

export const tideInstantPath = (slug: string, at: Date, timeZone: string) =>
  `/tides/${slug}/${formatInstant(at, timeZone)}`
