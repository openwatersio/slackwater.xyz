import { createFileRoute } from '@tanstack/react-router'
import { TideOrbit } from '#/components/TideOrbit'

const CANONICAL = 'https://slackwater.xyz/learn/tides/'

export const Route = createFileRoute('/learn/tides')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { title: 'How the Moon makes two high tides · Slackwater' },
      {
        name: 'description',
        content:
          'An interactive explanation of the near-side and far-side ocean bulges, using the Earth–Moon barycentre.',
      },
      { property: 'og:url', content: CANONICAL },
      { property: 'og:title', content: 'How the Moon makes two high tides' },
    ],
  }),
  component: TidesExplainer,
})

function TidesExplainer() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="flex items-center justify-between gap-4">
        <a href="/" className="text-lg font-semibold tracking-tight text-sw-paper">
          Slackwater
        </a>
        <span className="text-sm text-sw-steel">How tides work</span>
      </nav>

      <article>
        <header className="mx-auto mt-16 max-w-3xl text-center sm:mt-24">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-sw-steel">
            Start with the puzzle
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-sw-paper sm:text-6xl">
            How can the Moon make a high tide on both sides of Earth?
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-sw-foam sm:text-xl">
            The bulge facing the Moon is easy to picture. The one facing away only makes sense
            when Earth is allowed to move too.
          </p>
        </header>

        <section className="mt-12 sm:mt-16" aria-labelledby="shared-orbit-heading">
          <h2 id="shared-orbit-heading" className="sr-only">
            Reveal the Earth and Moon&rsquo;s shared orbit
          </h2>
          <TideOrbit />
        </section>

        <section className="mx-auto mt-16 max-w-3xl sm:mt-24">
          <h2 className="text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl">
            Watch Earth&rsquo;s centre
          </h2>
          <div className="mt-6 space-y-6 text-lg leading-relaxed text-sw-foam">
            <p>
              The Moon pulls on all of Earth. Because gravity gets weaker with distance, it
              pulls the near-side water most, Earth&rsquo;s centre a little less, and the far-side
              water least.
            </p>
            <p>
              So the far-side water is not pushed away from the Moon. It falls toward the Moon
              too. It simply cannot keep up with Earth&rsquo;s centre. From our moving viewpoint on
              Earth, that water is left behind and forms the second bulge.
            </p>
            <p>
              NOAA describes the same balance from a frame turning with the Earth–Moon system:
              the Moon&rsquo;s unequal pull combines with the centrifugal effect of their monthly
              shared orbit. That is different from the centrifugal effect of Earth&rsquo;s daily spin.
            </p>
          </div>

          <aside className="mt-10 rounded-2xl border border-white/10 bg-sw-canvas px-5 py-5 sm:px-6">
            <h3 className="font-semibold text-sw-paper">The sentence to remember</h3>
            <p className="mt-2 text-lg leading-relaxed text-sw-foam">
              Near water falls toward the Moon faster than Earth. Far water falls toward the
              Moon slower than Earth.
            </p>
          </aside>
        </section>

        <footer className="mx-auto mt-20 max-w-3xl border-t border-white/10 pt-6 text-sm leading-relaxed text-sw-steel">
          <p>
            Source:{' '}
            <a
              href="https://www.tidesandcurrents.noaa.gov/restles3"
              className="underline underline-offset-4 hover:text-sw-foam"
            >
              NOAA, The Astronomical Tide-Producing Forces
            </a>
            . This first model assumes a smooth, water-covered Earth. Continents, depth, and
            friction are why real local tides are more complicated.
          </p>
        </footer>
      </article>
    </main>
  )
}
