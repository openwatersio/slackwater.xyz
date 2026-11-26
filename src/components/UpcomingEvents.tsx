import { useEffect, useState } from 'react'
import { upcomingEvents } from '#/lib/discovery'
import { EVENTS, eventAttribution, eventContext, eventPath, eventWhen } from '#/lib/water-events'

export function UpcomingEvents() {
  const [now, setNow] = useState<number>()
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const events = now === undefined ? [] : upcomingEvents(EVENTS, now)
  if (now === undefined || events.length === 0) return null
  return (
    <section className="mt-10 rounded-2xl border border-sw-steel/25 p-6" aria-labelledby="events-heading">
      <h2 id="events-heading" className="text-2xl font-semibold text-sw-paper">Water events</h2>
      {events.map((event) => <article key={event.id} className="mt-4">
        <h3 className="text-lg font-semibold text-sw-paper">{event.title}</h3>
        <p className="mt-2 text-sw-foam">
          {eventWhen(event)} · {event.value} predicted by {event.source}.
        </p>
        <p className="mt-2 text-sm text-sw-steel">{eventContext(event)} Predictions are not observations or flood forecasts; weather can raise water levels. Check <a href="https://www.weather.gov/alerts" className="underline underline-offset-4">National Weather Service alerts</a> for warnings.</p>
        <p className="mt-2 text-sm text-sw-steel">{eventAttribution(event)}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href={eventPath(event)} className="text-sw-paper underline underline-offset-4">View and share this event</a>
          {event.source === 'NOAA' && <a href="/king-tides/washington/" className="text-sw-paper underline underline-offset-4">NOAA predictions and king tide dates</a>}
        </p>
      </article>)}
      <p className="mt-4 text-sm"><a href="/king-tides/" className="text-sw-paper underline underline-offset-4">Explore king tide dates and places</a></p>
    </section>
  )
}
