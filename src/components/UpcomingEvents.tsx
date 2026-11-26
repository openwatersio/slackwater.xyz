import { useEffect, useState } from 'react'
import { upcomingEvents, type Event } from '#/lib/discovery'
import { KING_TIDE_REGIONS, kingTidePath } from '#/lib/king-tide-regions'
import { EVENTS, eventPath, eventWhen } from '#/lib/water-events'

export function relativeEventDay(at: Date, now: number, timeZone: string): string {
  const civilDay = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day')) / 86_400_000
  }
  const days = civilDay(at) - civilDay(new Date(now))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export function EventCard({ event, now }: { event: Event; now: number }) {
  if (!event.highlight) return null
  const above = (event.highlight.peakFeet - event.highlight.averageHigherHighFeet).toFixed(1)
  return <a href={eventPath(event)} className="mt-4 block rounded-xl border border-sw-steel/25 p-5 transition hover:border-sw-foam/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sw-foam">
    <h3 className="text-lg font-semibold text-sw-paper">{event.title} <span className="text-sw-steel">· {relativeEventDay(new Date(event.time), now, event.timeZone)}</span></h3>
    <p className="mt-2 text-sw-foam">{event.highlight.peakFeet.toFixed(1)} ft · {above} ft above the average daily high tide</p>
    <p className="mt-2 text-sm text-sw-steel">{eventWhen(event)} · One of the season’s highest tides, selected by Slackwater from NOAA predictions</p>
  </a>
}

export function UpcomingEvents() {
  const [now, setNow] = useState<number>()
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const events = now === undefined ? [] : upcomingEvents(EVENTS, now).filter((event) => event.highlight)
  if (now === undefined || events.length === 0) return null
  const region = KING_TIDE_REGIONS.find((item) => item.stations.some(([path]) => path === events[0].path))
  return <section className="mt-10" aria-labelledby="events-heading">
    <h2 id="events-heading" className="text-2xl font-semibold text-sw-paper">Upcoming Events</h2>
    {events.map((event) => <EventCard key={event.id} event={event} now={now} />)}
    <p className="mt-4 text-sm"><a href={region ? kingTidePath(region) : '/king-tides/'} className="text-sw-paper underline underline-offset-4">See all king tide dates for the area</a></p>
  </section>
}
