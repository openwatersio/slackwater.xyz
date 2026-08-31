import { createFileRoute } from '@tanstack/react-router'

const CANONICAL = 'https://slackwater.xyz/stations/'
const TITLE = 'Stations — Slackwater'
const DESCRIPTION =
  'Browse every tide and tidal current station Slackwater predicts: 2,765 tide stations worldwide and 865 current stations across the US and Canada.'

export const Route = createFileRoute('/stations/')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: Stations,
})

function Stations() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">Stations</h1>
      <p className="mt-3 text-sw-steel">
        Every station Slackwater predicts. Heights come from harmonic constituents; currents carry
        their own flood and ebb axes.
      </p>
      <ul className="mt-10 space-y-4">
        <li>
          <a href="/stations/tides/" className="text-xl text-sw-paper hover:text-sw-leaf">
            Tide stations
          </a>
          <p className="text-sw-steel">2,765 worldwide.</p>
        </li>
        <li>
          <a href="/stations/currents/" className="text-xl text-sw-paper hover:text-sw-leaf">
            Current stations
          </a>
          <p className="text-sw-steel">865 across the US and Canada.</p>
        </li>
      </ul>
    </main>
  )
}
