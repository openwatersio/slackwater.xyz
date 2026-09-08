import { createFileRoute } from '@tanstack/react-router'
import { ScrubHero } from '#/components/ScrubHero'
import { Shot } from '#/components/Shot'
import { SITE_DESCRIPTION } from '#/routes/__root'

const CANONICAL = 'https://slackwater.xyz/'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { property: 'og:url', content: CANONICAL },
      {
        // Claims only what the page already claims: a free iOS app, no ratings
        // invented, no features the app doesn't ship.
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'MobileApplication',
          name: 'Slackwater',
          description: SITE_DESCRIPTION,
          url: CANONICAL,
          image: 'https://slackwater.xyz/og.png',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'iOS',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          publisher: {
            '@type': 'Organization',
            name: 'Open Waters',
            url: 'https://openwaters.io',
          },
        },
      },
    ],
  }),
  component: Home,
})


function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-sw-leaf sm:text-[0.7rem] sm:tracking-[0.16em]">
      {children}
    </span>
  )
}

function Home() {
  return (
    <>
      <ScrubHero />
      <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-6">
        {/* ── Correctness first, per gtm.md's ordering ───────────────────── */}
        <section className="mt-20 sm:mt-28">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-12">
          <div className="max-w-xl leading-relaxed text-sw-foam">
            <Eyebrow>Currents, not just tides</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
              Heights are the easy half.
            </h2>
            <p className="mt-5">
              The harder question is the current. When does the pass go slack? How hard is it
              running at max? Can you get through before it turns?
            </p>
            <p className="mt-4 text-sw-steel">
              Most tide apps skip it, or bury a number with no direction and no window. Slackwater
              gives you the slack time, how long it lasts, the speed and set at max flood and max
              ebb, and a curve you can scrub through the week.
            </p>
          </div>
          <div className="sm:w-[260px]">
            <Shot
              src="/shots/m2-current-scrubbed.webp"
              alt="Deception Pass Narrows in the app: ebbing at 3.1 knots to the west-north-west, next slack in 5 hours 26 minutes and lasting only 19 minutes, above a scrubbable current curve showing 5.2 knot floods against a 6.3 knot ebb with the slack band drawn across it."
              caption="Deception Pass (Narrows), ebbing at 3.1 kn. Next slack is in 5h 26m and lasts 19 minutes — which is the number that decides whether you go."
            />
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-12">
          <div className="max-w-xl leading-relaxed text-sw-foam">
            <Eyebrow>Any moment, not just now</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
              Scrub to the hour you care about.
            </h2>
            <p className="mt-5">
              Drag the timeline and the whole readout follows it — the height at that minute, how
              fast it is moving, the sun and moon overhead, the range for the day. Let go and it
              stays where you left it; one tap comes back to now.
            </p>
            <p className="mt-4 text-sw-steel">
              A week of highs and lows sits underneath, so working out tomorrow&rsquo;s departure
              does not mean doing arithmetic on a printed table.
            </p>
          </div>
          <div className="sm:w-[260px]">
            <Shot
              src="/shots/m1-detail-scrubbed.webp"
              alt="Friday Harbor tide detail in the app: high tide moving at 0.0 feet per hour, next low of 1.7 feet in 5 hours 58 minutes, and the curve scrubbed to 6:41 AM reading 6.1 feet, with sunrise, sunset and a waning gibbous moon along the top and a 4.4 foot range below."
              caption="Friday Harbor, scrubbed to 6:41 AM: 6.1 ft, and a 4.4 ft range across the day."
            />
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <Eyebrow>Where the numbers come from</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
          Checked against the agencies&rsquo; own predictions.
        </h2>
        <div className="mt-5 max-w-2xl space-y-4 leading-relaxed text-sw-foam">
          <p>
            Harmonic constituents published by NOAA and the Canadian Hydrographic Service, computed
            on your phone rather than fetched from anyone&rsquo;s server. The engine is validated
            against those agencies&rsquo; own published predictions, and the deviations are
            written down:
          </p>
          <dl className="grid gap-px overflow-hidden rounded-3xl border border-sw-card-stroke bg-white/10 sm:grid-cols-2">
            <div className="bg-sw-page p-4">
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sw-leaf">
                Tides · Friday Harbor
              </dt>
              <dd className="mt-2 text-lg [font-variant-numeric:tabular-nums] text-sw-paper">
                7.9 min · 3.5 cm
              </dd>
              <dd className="mt-1 text-sm text-sw-steel">maximum deviation vs NOAA</dd>
            </div>
            <div className="bg-sw-page p-4">
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sw-leaf">
                Currents · Bellingham Channel
              </dt>
              <dd className="mt-2 text-lg [font-variant-numeric:tabular-nums] text-sw-paper">
                9.7 min · 0.055 kn
              </dd>
              <dd className="mt-1 text-sm text-sw-steel">maximum deviation vs NOAA</dd>
            </div>
          </dl>
          {/* The live "yesterday's max deviation" receipt goes here once the
              nightly verification job exists — slackwater-engine#4. Until then
              this section shows point-in-time validation, which is true, rather
              than a live number, which would not be. */}
          <p className="text-sw-steel">
            Canadian gates come from CHS. Where a source is online-only or lower confidence, the app
            says so rather than presenting it as settled.
          </p>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-12">
          <div className="max-w-xl leading-relaxed text-sw-foam">
            <Eyebrow>Works where there is no signal</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
              No spinner. No &ldquo;no internet connection.&rdquo;
            </h2>
            <p className="mt-5">
              Thousands of US and Canadian stations ship inside the app. Predictions are
              deterministic astronomy, not a live feed — so the answer is already on the phone
              before you leave the dock.
            </p>
            <p className="mt-4 text-sw-steel">
              The chart works offline too. Depths, seamarks and the shoreline are downloaded once
              and drawn on the device, so the map still means something in an anchorage with no
              bars.
            </p>
          </div>
          <div className="sm:w-[260px]">
            <Shot
              src="/shots/m41-map-zoom.webp"
              alt="The app's chart zoomed to the Salish Sea, densely covered with tide stations as blue squares and current stations as orange circles, with place names from Sechelt Rapids and Squamish down past Seattle to Budd Inlet."
              caption="Zoomed to the Salish Sea: blue squares are tide stations, orange circles are currents. Tides run worldwide, currents across the US and Canada. Every one of them predicts without a connection."
            />
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-12">
          <div className="max-w-xl leading-relaxed text-sw-foam">
            <Eyebrow>One list</Eyebrow>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
              Tides and currents, nearest first.
            </h2>
            <p className="mt-5">
              One list holds both kinds — a harbour&rsquo;s height and a pass&rsquo;s speed and
              set, each with the next thing it does and how far away it is. No mode to switch, no
              separate tab for currents.
            </p>
            <p className="mt-4 text-sw-steel">
              Where you are sits on top, favourites above the rest, recents at the bottom. The
              passes you actually run are never more than a scroll away.
            </p>
          </div>
          <div className="sm:w-[260px]">
            <Shot
              src="/shots/list-located.webp"
              alt="The app's list located at Friday Harbor: a My Location card reading 1.1 feet and falling with a low of 0.8 feet at 12:06 PM, then Near Me — Point George, Wasp Passage narrows, Pear Point and Upright Channel narrows — each in knots with its set, whether it is ebbing or flooding, its next slack or max, and how many nautical miles away it is."
              caption="Located at Friday Harbor: the harbour&rsquo;s height on top, four nearby passes under it, nearest first."
            />
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-28">
        <Eyebrow>Every station, on the web</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
          Browse the whole corpus.
        </h2>
        <div className="mt-5 max-w-2xl space-y-4 leading-relaxed text-sw-foam">
          <p>
            Every station has its own page, so a link you send works for someone who
            hasn&rsquo;t installed anything &mdash; they get the curve, not a screenshot of it.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
          <a href="/stations/tides/" className="text-sw-paper underline underline-offset-4 hover:text-sw-leaf">
            2,775 tide stations
          </a>
          <a href="/stations/currents/" className="text-sw-paper underline underline-offset-4 hover:text-sw-leaf">
            865 current stations
          </a>
        </div>
      </section>

      <section className="mt-20 rounded-3xl border border-sw-card-stroke bg-sw-card-fill p-6 shadow-card sm:mt-28 sm:p-8">
        <Eyebrow>The deal</Eyebrow>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-sw-paper sm:text-3xl">
          Free, no account, no ads.
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-sw-foam">
          The core is free and stays free: every station, every date, the curves, the slack times,
          offline. No account to create, no ads, nothing tracked, nothing sold. It does not need a
          server, so it does not need to earn one.
        </p>
      </section>

      <footer className="mt-20 border-t border-white/10 pt-6 text-sm text-sw-steel">
        <p>
          Predictions are not observations — conditions vary with weather and river flow.{' '}
          <strong className="font-semibold text-sw-foam">Not for navigation.</strong>
        </p>
        <p className="mt-3">
          Built by{' '}
          <a href="https://openwaters.io" className="underline underline-offset-4">
            Open Waters
          </a>
          .{' '}
          <a href="/stations/" className="underline underline-offset-4">
            Stations
          </a>
          .{' '}
          <a href="/compare/best-tide-and-current-apps-iphone/" className="underline underline-offset-4">
            Compare
          </a>
          .{' '}
          <a href="/privacy/" className="underline underline-offset-4">
            Privacy
          </a>
          .{' '}
          <a href="/support/" className="underline underline-offset-4">
            Support
          </a>
          .
        </p>
      </footer>
      </main>
    </>
  )
}
