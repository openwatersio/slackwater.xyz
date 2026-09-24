import { createFileRoute } from '@tanstack/react-router'
import { TESTFLIGHT } from '#/lib/links'
import { Shot } from '#/components/Shot'
import { SITE_DESCRIPTION } from '#/routes/__root'

const CANONICAL = 'https://slackwater.xyz/'
const SOURCE = 'https://github.com/openwatersio/slackwater-ios'

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

/** Lucide's wifi-off (ISC), inlined: one glyph is not worth a dependency. */
function NoSignal({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 20h.01" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function Cta() {
  return TESTFLIGHT ? (
    <a
      href={TESTFLIGHT}
      className="inline-block rounded-full bg-sw-leaf px-6 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
    >
      Get the beta on TestFlight
    </a>
  ) : (
    <span className="inline-block rounded-full border border-sw-leaf/30 px-6 py-3 font-medium text-sw-steel">
      iPhone beta — opening soon
    </span>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-2xl font-semibold leading-tight tracking-tight text-sw-paper sm:text-3xl">
      {children}
    </h2>
  )
}

/** The paragraphs under a heading: the first carries the claim, the rest are
 *  quieter. */
function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 space-y-3 text-lg leading-relaxed text-sw-foam [&>p+p]:text-base [&>p+p]:text-sw-steel">
      {children}
    </div>
  )
}

/** A feature: a heading and its prose beside one shot. `flip` puts the shot
 *  on the left so consecutive features alternate down the page. */
function Feature({
  title,
  children,
  shot,
  flip,
}: {
  title: React.ReactNode
  children: React.ReactNode
  shot: React.ReactNode
  flip?: boolean
}) {
  return (
    <section
      className={`mt-24 grid gap-10 sm:items-center sm:gap-16 ${
        flip ? 'sm:grid-cols-[320px_1fr]' : 'sm:grid-cols-[1fr_320px]'
      }`}
    >
      <div className="max-w-xl">
        <Heading>{title}</Heading>
        <Prose>{children}</Prose>
      </div>
      <div className={`mx-auto w-full max-w-[320px] ${flip ? 'sm:order-first' : ''}`}>{shot}</div>
    </section>
  )
}

function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="flex flex-wrap items-center justify-between gap-4">
        <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
          Slackwater
        </a>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="https://openwaters.io/tides/slackwater"
            className="text-sm text-sw-foam underline-offset-4 hover:underline"
          >
            Docs
          </a>
          <a
            href="https://github.com/openwatersio/slackwater"
            className="text-sm text-sw-foam underline-offset-4 hover:underline"
          >
            GitHub
          </a>
        </div>
      </nav>

      <header className="mt-12 grid gap-12 sm:mt-16 lg:grid-cols-[1fr_360px] lg:items-center lg:gap-20">
        <div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-sw-paper sm:text-6xl">
            The tide and currents app that works without signal{' '}
            <NoSignal className="inline-block size-[0.7em] align-[-0.05em] text-sw-steel" />
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-snug text-sw-foam sm:text-xl">
            Tides worldwide, currents across the US and Canada. Every station, every date,
            already on your phone.
          </p>
          <div className="mt-8">
            <Cta />
          </div>
          <p className="mt-4 text-sm text-sw-steel">Free. Open source. No account, no ads.</p>
          <a
            href="/learn/tides/"
            className="mt-5 inline-block font-medium text-sw-foam underline underline-offset-4 transition hover:text-sw-paper"
          >
            Learn how tides work <span aria-hidden>→</span>
          </a>
        </div>

        {/* The recording runs taller than the hero, so it is clipped and faded
            into the page. The day poster remains when motion is reduced or
            autoplay is unavailable. */}
        <div className="mx-auto h-[540px] w-full max-w-[360px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)] sm:h-[640px]">
          <figure className="@container m-0">
            <video
              autoPlay
              muted
              playsInline
              preload="metadata"
              poster="/shots/tides-day.webp"
              width={780}
              height={1694}
              aria-label="Friday Harbor in Slackwater scrubbing from afternoon into a full-moon night."
              className="w-full rounded-[min(3rem,13cqw)] shadow-2xl shadow-sw-navy-deep/60 ring-1 ring-white/10"
            >
              <source
                src="/shots/tides-day-to-night.mp4"
                type="video/mp4"
                media="(prefers-reduced-motion: no-preference)"
              />
              <img
                src="/shots/tides-night.webp"
                alt="Friday Harbor in Slackwater at 11:30pm under a starry sky with a full moon."
                width={780}
                height={1695}
              />
            </video>
          </figure>
        </div>
      </header>

      <section className="mt-24 border-t border-white/10 pt-10 sm:mt-28">
        <Heading>Checked against the agencies&rsquo; own predictions.</Heading>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sw-foam">
          Harmonic constituents published by NOAA and the Canadian Hydrographic Service, summed
          on your phone rather than fetched from anyone&rsquo;s server. The engine is validated
          against those agencies&rsquo; published predictions, and the largest deviations are
          written down.
        </p>
        <dl className="mt-6 grid max-w-2xl gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-sw-steel">Tides at Friday Harbor</dt>
            <dd className="mt-1 text-xl text-sw-paper [font-variant-numeric:tabular-nums]">
              Within 7.9 minutes and 3.5 cm of NOAA
            </dd>
          </div>
          <div>
            <dt className="text-sm text-sw-steel">Currents in Bellingham Channel</dt>
            <dd className="mt-1 text-xl text-sw-paper [font-variant-numeric:tabular-nums]">
              Within 9.7 minutes and 0.055 knots of NOAA
            </dd>
          </div>
        </dl>
        {/* The live "yesterday's max deviation" receipt goes here once the
            nightly verification job exists — slackwater-engine#4. Until then
            this section shows point-in-time validation, which is true, rather
            than a live number, which would not be. */}
        <p className="mt-6 max-w-2xl text-sw-steel">
          Where a source is online-only or lower confidence, the app says so rather than
          presenting it as settled.
        </p>
      </section>

      <Feature
        title="Scrub to the hour you care about."
        shot={
          <Shot
            src="/shots/tides-day.webp"
            alt="Friday Harbor in the app at 1:00pm under a daytime sky: rising through 3.1 feet, high 4 hours 31 minutes later, a 4.7 foot range, sunrise at 7:04am and sunset at 7:01pm marked on the axis."
            caption="Friday Harbor at 1:00pm, rising through 3.1 feet toward a 6.9 foot high. Sunrise and sunset sit on the axis, and the moon shows its phase."
            crop
          />
        }
      >
        <p>
          Drag the timeline and the whole screen follows it: the height at that minute, whether
          it is rising or falling, the range for the day, and the sky overhead.
        </p>
        <p>
          A week of highs and lows sits underneath, so working out tomorrow&rsquo;s departure
          does not mean doing arithmetic on a printed table.
        </p>
      </Feature>

      <section className="mt-24">
        <div className="max-w-xl">
          <Heading>Currents too, with direction and slack.</Heading>
          <Prose>
            <p>
              Heights are the easy half. The harder question at a pass is the current: when it
              goes slack, how long it stays that way, and how hard it runs at max. Slackwater
              gives the speed and set right now, the time to the next slack, and a week of maxes
              underneath.
            </p>
            <p>
              Deception Pass on one day: ebbing west-north-west at sunrise, flooding
              east-south-east by noon.
            </p>
          </Prose>
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:gap-8">
          <Shot
            src="/shots/currents-sunrise.webp"
            alt="Deception Pass (Narrows) in the app at sunrise: ebbing at 5.8 knots to the west-north-west, slack 2 hours 50 minutes later, the sun rising at the left edge of the curve and a 5.3 knot flood coming at 12:40pm."
            caption="7:10am, ebbing at 5.8 knots. Slack is 2 hours 50 minutes away."
            crop
          />
          <Shot
            src="/shots/currents-day.webp"
            alt="Deception Pass (Narrows) in the app at 1:00pm: flooding at 5.2 knots to the east-south-east, slack 2 hours 37 minutes later, a next max of 7.2 knots ebbing at 6:30pm, and the week's floods, slacks and ebbs listed underneath."
            caption="1:00pm, flooding at 5.2 knots. The ebb behind it peaks at 7.2."
            crop
          />
        </div>
      </section>

      <Feature
        title="Tides and currents, nearest first."
        flip
        shot={
          <Shot
            src="/shots/list.webp"
            alt="The app's list located at Friday Harbor: the harbour's tide on top at 6.8 feet and falling, Point George's current under it at 0.5 knots and slack, then favourites Port Townsend and Deception Pass, each with its curve for the day."
            caption="Located at Friday Harbor: the harbour's tide on top, the nearest pass under it, favourites below."
            crop
          />
        }
      >
        <p>
          One list holds both kinds: a harbour&rsquo;s height and a pass&rsquo;s speed and set,
          each with the next thing it does and how far away it is. No mode to switch.
        </p>
        <p>Where you are sits on top, favourites under it, the rest by distance.</p>
      </Feature>

      <Feature
        title={<>No spinner. No &ldquo;no internet connection.&rdquo;</>}
        shot={
          <Shot
            src="/shots/map.webp"
            alt="The app's map of the Salish Sea from Squamish down to Tacoma, covered in stations: blue squares for tides, orange circles for currents."
            caption="The Salish Sea from Squamish to Tacoma. Squares are tide stations, circles are currents."
            crop
          />
        }
      >
        <p>
          Nothing is cached and nothing expires. The predictions are made on the phone from the
          same published data the printed tables use, so every station and every date is there
          with no connection.
        </p>
        <p>Thousands of stations ship inside the app.</p>
      </Feature>

      <section className="mt-24 border-t border-white/10 pt-10 sm:mt-28">
        <Heading>Free, open source, no account, no ads.</Heading>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sw-foam">
          The core is free and stays free: every station, every date, the curves, the slack
          times, offline. Nothing tracked, nothing sold. It does not need a server, so it does
          not need to earn one.
        </p>
        <p className="mt-3 max-w-2xl text-sw-steel">
          The app is{' '}
          <a href={SOURCE} className="underline underline-offset-4 hover:text-sw-foam">
            open source under the GPL
          </a>
          , on an open prediction engine. Built by sailors who run these passes; the app exists
          because we needed it.
        </p>
        <div className="mt-8">
          <Cta />
        </div>
      </section>

      <footer className="mt-20 border-t border-white/10 pt-6 text-sm text-sw-steel">
        <p>
          Every station has its own page, so a link you send works for someone who hasn&rsquo;t
          installed anything:{' '}
          <a href="/stations/tides/" className="underline underline-offset-4">
            4,792 tide stations
          </a>{' '}
          and{' '}
          <a href="/stations/currents/" className="underline underline-offset-4">
            865 current stations
          </a>
          .
        </p>
        <p className="mt-3">
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
          <a href="/learn/tides/" className="underline underline-offset-4">
            How tides work
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
          .{' '}
          <a href={SOURCE} className="underline underline-offset-4">
            Source
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
