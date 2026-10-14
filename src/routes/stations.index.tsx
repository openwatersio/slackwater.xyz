import { createFileRoute } from '@tanstack/react-router'
import { DirectoryNav } from '#/components/DirectoryNav'
import { TidesExplainerCard } from '#/components/TidesExplainerCard'
import { stationsHub, type HubKind } from '#/lib/catalogue-server'
import { collectionJsonLd } from '#/lib/json-ld'

const CANONICAL = 'https://slackwater.xyz/stations/'
const TITLE = 'Tide and tidal current stations by country — Slackwater'

const description = (tide: HubKind, current: HubKind) =>
  `Browse ${tide.count.toLocaleString()} tide stations worldwide and ${current.count.toLocaleString()} tidal current stations across the US and Canada, by country, state and province.`

/** The page's links in reading order: each kind's index, then its countries. */
const hubLinks = ({ tide, current }: { tide: HubKind; current: HubKind }) =>
  [
    { href: tide.href, name: 'Tide stations' },
    ...tide.top,
    { href: current.href, name: 'Current stations' },
    ...current.top,
  ]

export const Route = createFileRoute('/stations/')({
  loader: () => stationsHub(),
  head: ({ loaderData }) => {
    const content = loaderData ? description(loaderData.tide, loaderData.current) : undefined
    return {
      links: [{ rel: 'canonical', href: CANONICAL }],
      meta: [
        { title: TITLE },
        ...(content ? [{ name: 'description', content }, { property: 'og:description', content }] : []),
        { property: 'og:title', content: TITLE },
        { property: 'og:url', content: CANONICAL },
        ...(loaderData ? [{ 'script:ld+json': collectionJsonLd('Stations', CANONICAL, hubLinks(loaderData)) }] : []),
      ],
    }
  },
  component: Stations,
})

/**
 * The hub above both kinds' indexes.
 *
 * It names the countries with the most stations under each kind, so a reader
 * one click from here is on a page of stations rather than on another index.
 */
function Stations() {
  const { tide, current } = Route.useLoaderData()
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <DirectoryNav />
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">Stations</h1>
      <p className="mt-3 text-sw-steel">
        Every station Slackwater predicts, worldwide for tides and across the US and Canada for
        currents.
      </p>
      <Kind heading="Tide stations" blurb={`${tide.count.toLocaleString()} worldwide.`} hub={tide} more="All countries" />
      <Kind
        heading="Current stations"
        blurb={`${current.count.toLocaleString()} across the US and Canada.`}
        hub={current}
        more="All current stations"
      />
      <div className="mt-14">
        <TidesExplainerCard />
      </div>
    </main>
  )
}

function Kind({ heading, blurb, hub, more }: { heading: string; blurb: string; hub: HubKind; more: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl text-sw-paper">
        <a href={hub.href} className="hover:text-sw-leaf">
          {heading}
        </a>
      </h2>
      <p className="text-sw-steel">{blurb}</p>
      <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {hub.top.map((p) => (
          <li key={p.href}>
            <a href={p.href} className="text-sw-paper/90 hover:text-sw-leaf">
              {p.name}
            </a>{' '}
            <span className="text-sw-steel">{p.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <a href={hub.href} className="mt-3 inline-block text-sm text-sw-steel hover:text-sw-paper">
        {more}
      </a>
    </section>
  )
}
