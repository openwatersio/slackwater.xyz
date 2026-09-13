import { sunAltAz, sunEvents } from '@openwaters/almanac'

/** Daylight spans inside a chart window, including a polar day. */
export function daylightSpans(start: Date, end: Date, latitude: number, longitude: number): Array<[Date, Date]> {
  try {
    const place = { latitudeDeg: latitude, longitudeDeg: longitude }
    const events = sunEvents(start, end, place).filter((event) => event.kind === 'rise' || event.kind === 'set')
    if (!events.length) {
      const noon = new Date((start.getTime() + end.getTime()) / 2)
      return sunAltAz(noon, place).altDeg > 0 ? [[start, end]] : []
    }
    const spans: Array<[Date, Date]> = []
    let rise = events[0]?.kind === 'set' ? start : undefined
    for (const event of events) {
      if (event.kind === 'rise') rise = event.time
      else if (rise) {
        spans.push([rise, event.time])
        rise = undefined
      }
    }
    if (rise) spans.push([rise, end])
    return spans
  } catch {
    return []
  }
}
