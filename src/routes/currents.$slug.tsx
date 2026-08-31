import { createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CurrentCurve } from '#/components/CurrentCurve'
import { stationBySlug } from '#/lib/catalogue-server'

const CANONICAL = 'https://slackwater.xyz/currents/'

export const Route = createFileRoute('/currents/$slug')({
  loader: async ({ params }) => {
    // stationBySlug lives behind the server boundary (see below). The loader
    // returns ONE station, which is what gets serialised into the page.
    const station = await stationBySlug({ data: { kind: 'current', slug: params.slug } })
    if (!station) throw notFound()
    return { station }
  },
  head: ({ loaderData }) => {
    const s = loaderData?.station
    if (!s) return {}
    const title = `${s.name} — tidal currents`
    const description = `Slack water and maximum flood and ebb for ${s.name}, computed from harmonic constituents.`
    return {
      links: [{ rel: 'canonical', href: `${CANONICAL}${s.slug}/` }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: `${CANONICAL}${s.slug}/` },
        { property: 'og:image', content: `https://slackwater.xyz/og/currents/${s.slug}.png` },
      ],
    }
  },
  component: CurrentStation,
})

function CurrentStation() {
  const { station } = Route.useLoaderData()
  // A fixed literal for the server render, then the real clock on the client.
  // `new Date()` here would bake build time into all 3,607 prerendered pages
  // AND differ between server and client, which is a hydration mismatch.
  // `src/routes/index.tsx:104` already does exactly this — follow it.
  const [now, setNow] = useState(() => new Date('2026-08-21T12:00:00Z'))
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const start = new Date(now.getTime() - 6 * 3600_000)
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{station.region}</p>
      <CurrentCurve station={station} start={start} hours={24} now={now} />
    </main>
  )
}
