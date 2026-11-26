import { createFileRoute, notFound } from '@tanstack/react-router'
import { FindWater } from '#/components/FindWater'
import { EVENTS, eventAttribution, eventContext, eventPath, eventWhen } from '#/lib/water-events'
import { instantPath } from './instant-url'

export const Route = createFileRoute('/water-events/$id')({
  loader: ({ params }) => {
    const event = EVENTS.find((item) => item.id === params.id)
    if (!event) throw notFound()
    return { ...event, when: eventWhen(event) }
  },
  head: ({ loaderData: event }) => {
    if (!event) return {}
    const when = event.when
    const description = `${event.source} predicted ${event.value} at ${when}. Predictions are not observations.`
    const url = `https://slackwater.xyz${eventPath(event)}`
    return { links: [{ rel: 'canonical', href: url }, { rel: 'alternate', type: 'text/markdown', href: `${eventPath(event).slice(0, -1)}.md` }], meta: [
      { title: `${event.title} | Slackwater` },
      { name: 'description', content: description },
      { property: 'og:title', content: event.title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
    ] }
  },
  component: EventPage,
})

function EventPage() {
  const event = Route.useLoaderData()
  const when = event.when
  return <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
    <a href="/" className="text-sw-paper underline underline-offset-4">Slackwater</a>
    <h1 className="mt-8 text-3xl font-semibold text-sw-paper sm:text-5xl">{event.title}</h1>
    <p className="mt-5 text-lg text-sw-foam">{event.source} predicted {event.value} at {when}.</p>
    <p className="mt-4 text-sw-steel">{eventContext(event)}</p>
    {event.highlight && <p className="mt-4 text-sw-steel">The average daily high tide is {event.highlight.averageHigherHighFeet} ft above MLLW. This is the average of each day’s higher high tide, based on <a href={event.highlight.datumUrl} className="underline">NOAA’s tidal datum</a>.</p>}
    <p className="mt-4 text-sw-steel">Predictions are not observations or flood forecasts. Wind, waves and weather can raise the water. Check <a className="underline" href="https://www.weather.gov/alerts">National Weather Service alerts</a>.</p>
    <p className="mt-4 text-sm text-sw-steel">{eventAttribution(event)}</p>
    <p className="mt-5"><a className="text-sw-paper underline underline-offset-4" href={instantPath(event.path, new Date(event.time), event.timeZone)}>View the station at this time</a> {event.source === 'NOAA' && <> · <a className="text-sw-paper underline underline-offset-4" href="/king-tides/washington/">NOAA predictions and king tide dates</a></>}</p>
    <FindWater />
  </main>
}
