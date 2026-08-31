/**
 * Parse the instant segment of a share URL.
 *
 * Returns undefined rather than throwing or defaulting to now: a malformed
 * instant means the link is wrong, and silently rendering the current moment
 * would show the receiver different water from the one that was shared.
 */
export function parseInstant(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(raw)) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}
