import type { Event } from './discovery'
import { instantPath } from '../routes/instant-url'

const SEATTLE_DATUM_URL = 'https://tidesandcurrents.noaa.gov/benchmarks/9447130.html'

export const EVENTS: Event[] = [{
  id: 'seattle-2026-11-27',
  title: 'Seattle king tide',
  path: '/tides/us/wa/seattle/',
  time: '2026-11-27T15:39:00Z',
  timeZone: 'America/Los_Angeles',
  value: '12.7 ft above MLLW',
  highlight: { peakFeet: 12.695, averageHigherHighFeet: 11.36, datumUrl: SEATTLE_DATUM_URL },
  source: 'NOAA',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  expires: '2026-11-27T15:39:00Z',
}, {
  id: 'deception-pass-2026-11-27',
  title: 'Yokeko Point, Deception Pass maximum ebb',
  path: '/currents/us/wa/yokeko-point/',
  time: '2026-11-28T03:27:00Z',
  timeZone: 'America/Los_Angeles',
  value: '3.1 knots ebb toward southwest (232°)',
  source: 'Slackwater',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  expires: '2026-11-28T03:27:00Z',
}, {
  id: 'seattle-2027-01-25',
  title: 'Seattle king tide',
  path: '/tides/us/wa/seattle/',
  time: '2027-01-25T15:16:00Z',
  timeZone: 'America/Los_Angeles',
  value: '13.1 ft above MLLW',
  highlight: { peakFeet: 13.092, averageHigherHighFeet: 11.36, datumUrl: SEATTLE_DATUM_URL },
  source: 'NOAA',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  expires: '2027-01-25T15:16:00Z',
}]

export const eventPath = (event: Event) => `/water-events/${event.id}/`

export function eventWhen(event: Event): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: event.timeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).formatToParts(new Date(event.time))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')}, ${get('month')} ${get('day')}, ${get('year')} at ${get('hour')}:${get('minute')} ${get('dayPeriod')} ${get('timeZoneName')}`
}

export function eventContext(event: Event): string {
  return event.source === 'NOAA'
    ? 'Slackwater selects the season’s highest separate spring-tide peaks from NOAA predictions. The station chart uses Slackwater’s own prediction and may differ.'
    : `This is Slackwater’s prediction for ${event.title}.`
}

export const eventAttribution = (event: Event) => event.source === 'NOAA'
  ? 'NOAA Center for Operational Oceanographic Products and Services (https://tidesandcurrents.noaa.gov/)'
  : 'Slackwater database (https://github.com/openwatersio/slackwater-database)'

export function eventMarkdown(event: Event): string {
  return `# ${event.title}\n\n${event.source} predicted ${event.value} at ${eventWhen(event)}.\n\n${eventContext(event)}\n\n${event.highlight ? `The average daily high tide is ${event.highlight.averageHigherHighFeet} ft above MLLW. This is the average of each day’s higher high tide, based on [NOAA’s tidal datum](${event.highlight.datumUrl}).\n\n` : ''}Predictions are not observations or flood forecasts. Wind, waves and weather can raise the water. Check [National Weather Service alerts](https://www.weather.gov/alerts). Not for navigation.\n\n${eventAttribution(event)}\n\n[View the station at this time](${instantPath(event.path, new Date(event.time), event.timeZone)})\n`
}
