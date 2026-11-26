import type { Event } from './discovery'

export const EVENTS: Event[] = [{
  id: 'seattle-2026-11-27',
  title: 'Seattle king tide',
  path: '/tides/us/wa/seattle/',
  time: '2026-11-27T15:39:00Z',
  timeZone: 'America/Los_Angeles',
  value: '12.7 ft above MLLW',
  source: 'NOAA',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  published: '2026-11-01T00:00:00Z',
  expires: '2026-11-27T15:39:00Z',
}, {
  id: 'deception-pass-2026-11-27',
  title: 'Deception Pass maximum ebb',
  path: '/currents/us/wa/yokeko-point/',
  time: '2026-11-28T03:27:00Z',
  timeZone: 'America/Los_Angeles',
  value: '3.1 knots ebb toward southwest (232°)',
  source: 'Slackwater',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  published: '2026-11-01T00:00:00Z',
  expires: '2026-11-28T03:27:00Z',
}, {
  id: 'seattle-2027-01-25',
  title: 'Seattle king tide',
  path: '/tides/us/wa/seattle/',
  time: '2027-01-25T15:16:00Z',
  timeZone: 'America/Los_Angeles',
  value: '13.1 ft above MLLW',
  source: 'NOAA',
  editor: 'Open Waters',
  verified: '2026-11-26T10:58:00Z',
  published: '2026-11-01T00:00:00Z',
  expires: '2027-01-25T15:16:00Z',
}]

export const eventPath = (event: Event) => `/water-events/${event.id}/`
