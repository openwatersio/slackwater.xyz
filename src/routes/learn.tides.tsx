import { createFileRoute } from '@tanstack/react-router'
import {
  EarthWobbleAnimation,
  MoonPullAnimation,
  TideBlueprint,
  TideOrbit,
} from '#/components/TideOrbit'

const CANONICAL = 'https://slackwater.xyz/learn/tides/'

export const Route = createFileRoute('/learn/tides')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { title: 'How the Moon makes two high tides · Slackwater' },
      {
        name: 'description',
        content:
          'An interactive explanation of the near-side and far-side ocean bulges, using the Earth–Moon barycenter: their shared center of mass.',
      },
      { property: 'og:url', content: CANONICAL },
      { property: 'og:title', content: 'How the Moon makes two high tides' },
      { property: 'og:image', content: 'https://slackwater.xyz/og-tides.png' },
      {
        property: 'og:image:alt',
        content:
          'Earth and the Moon with ocean bulges on both sides, illustrating how the Moon makes two high tides.',
      },
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

        <section className="mx-auto mt-16 grid max-w-4xl gap-8 sm:mt-24 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-12">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-sw-steel">
              First
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl">
              The Moon pulls the nearest water
            </h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-sw-foam">
              <p>
                For the first pass, pretend Earth is fixed in space. The Moon&rsquo;s gravity is
                strongest at the water closest to it, so that water stretches toward the Moon.
              </p>
              <p>
                As the Moon circles Earth, the bulge follows. The shortcut explains only the
                near side.
              </p>
            </div>
          </div>
          <MoonPullAnimation />
        </section>

        <section className="mx-auto mt-20 grid max-w-4xl gap-8 sm:mt-28 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-12">
          <div className="lg:order-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-sw-steel">
              Next
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl">
              Earth wobbles around an off-center point
            </h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed text-sw-foam">
              <p>
                Earth and the Moon both orbit their barycenter: their shared center of mass. It
                sits inside Earth, offset from the planet&rsquo;s center, so Earth&rsquo;s center travels
                around a small circle.
              </p>
              <p>
                This wobble takes a month. It is part of the shared Earth–Moon orbit, not
                Earth&rsquo;s daily spin on its axis.
              </p>
            </div>
          </div>
          <EarthWobbleAnimation />
        </section>

        <section className="mt-20 sm:mt-28" aria-labelledby="shared-orbit-heading">
          <header className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-sw-steel">
              Finally
            </p>
            <h2
              id="shared-orbit-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl"
            >
              Put the pull and the wobble together
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-sw-foam">
              Move the slider from the fixed-Earth shortcut to the shared orbit. The second bulge
              appears as Earth begins to move around the barycenter.
            </p>
          </header>
          <TideOrbit />
        </section>

        <aside className="mx-auto mt-12 max-w-3xl rounded-2xl border border-white/10 bg-sw-canvas px-5 py-5 sm:px-6">
          <h3 className="font-semibold text-sw-paper">The sentence to remember</h3>
          <p className="mt-2 text-lg leading-relaxed text-sw-foam">
            Near water falls toward the Moon faster than Earth. Far water falls toward the Moon
            slower than Earth.
          </p>
          <p className="mt-4 leading-relaxed text-sw-steel">
            From a frame turning with the Earth–Moon system, NOAA describes the same balance as
            unequal lunar gravity plus the centrifugal effect of the monthly shared orbit. This
            is separate from the centrifugal effect of Earth&rsquo;s daily spin.
          </p>
        </aside>

        <section className="mt-20 sm:mt-28" aria-labelledby="numbers-heading">
          <header className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-sw-steel">
              For the nerds
            </p>
            <h2
              id="numbers-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl"
            >
              The numbers behind the picture
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-sw-foam">
              These are mean values. The drawing compresses the enormous gap so Earth, the
              barycenter, and the Moon can share one page.
            </p>
          </header>
          <TideBlueprint />
        </section>

        <footer className="mx-auto mt-20 max-w-3xl border-t border-white/10 pt-6 text-sm leading-relaxed text-sw-steel">
          <p>
            Sources:{' '}
            <a
              href="https://www.tidesandcurrents.noaa.gov/restles3"
              className="underline underline-offset-4 hover:text-sw-foam"
            >
              NOAA, The Astronomical Tide-Producing Forces
            </a>
            , and the{' '}
            <a
              href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html"
              className="underline underline-offset-4 hover:text-sw-foam"
            >
              NASA Moon Fact Sheet
            </a>
            . This first model assumes a smooth, water-covered Earth. Continents, depth, and
            friction are why real local tides are more complicated.
          </p>
        </footer>
      </article>
    </main>
  )
}
