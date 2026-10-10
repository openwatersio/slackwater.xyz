import { createFileRoute } from '@tanstack/react-router'
import { TESTFLIGHT } from '#/lib/links'
import { Shot } from '#/components/Shot'
import { SITE_DESCRIPTION } from '#/routes/__root'

const CANONICAL = 'https://slackwater.xyz/'
const SOURCE = 'https://github.com/openwatersio/slackwater-ios'
const LANGUAGES = [
  ['en', '🇬🇧', 'English'],
  ['fr-CA', '🇨🇦', 'Français'],
  ['es-ES', '🇪🇸', 'Español'],
  ['ja', '🇯🇵', '日本語'],
  ['de', '🇩🇪', 'Deutsch'],
  ['pt-BR', '🇧🇷', 'Português (Brasil)'],
  ['nl', '🇳🇱', 'Nederlands'],
  ['nb', '🇳🇴', 'Norsk bokmål'],
  ['sv', '🇸🇪', 'Svenska'],
  ['it', '🇮🇹', 'Italiano'],
  ['ko', '🇰🇷', '한국어'],
  ['da', '🇩🇰', 'Dansk'],
  ['pt-PT', '🇵🇹', 'Português (Portugal)'],
  ['fi', '🇫🇮', 'Suomi'],
] as const

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
          operatingSystem: 'iOS 26 or later; iPadOS 26 or later',
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
      <nav>
        <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
          Slackwater
        </a>
      </nav>

      <header className="mt-12 grid gap-12 sm:mt-16 lg:grid-cols-[1fr_360px] lg:items-center lg:gap-20">
        <div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-sw-paper sm:text-6xl">
            The free tide and currents app that works without signal{' '}
            <NoSignal className="inline-block size-[0.7em] align-[-0.05em] text-sw-steel" />
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-snug text-sw-foam sm:text-xl">
            Tides worldwide, currents across the US and Canada. Bundled stations are ready
            offline for any date.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-sw-steel">
            Canadian stations need an initial download. Some passes require a connection;
            the app tells you which.
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
                loading="lazy"
                alt="Friday Harbor in Slackwater at 11:30pm under a starry sky with a full moon."
                width={780}
                height={1695}
              />
            </video>
          </figure>
        </div>
      </header>

      <div className="mx-auto mt-8 max-w-2xl text-center text-sm">
        <p className="text-sw-steel">Available in {LANGUAGES.length} languages</p>
        <ul
          aria-label="Supported iOS app languages"
          role="list"
          className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sw-foam"
        >
          {LANGUAGES.map(([locale, flag, name]) => (
            <li key={locale} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">{flag}</span>
              <span lang={locale}>{name}</span>
            </li>
          ))}
        </ul>
      </div>

      <section className="mt-24 border-t border-white/10 pt-10 sm:mt-28">
        <Heading>Checked against the agencies&rsquo; own predictions.</Heading>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sw-foam">
          NOAA predictions use published harmonic constituents. Most Canadian stations build a
          model on your phone from Canadian Hydrographic Service predictions after a download;
          some passes fetch predictions when online. The engine is checked against the agencies&rsquo;
          published predictions.
        </p>
        <dl className="mt-6 grid max-w-2xl gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-sw-steel">Friday Harbor high and low tides</dt>
            <dd className="mt-1 text-xl text-sw-paper [font-variant-numeric:tabular-nums]">
              Within 7.9 minutes and 3.5 cm of NOAA
            </dd>
          </div>
          <div>
            <dt className="text-sm text-sw-steel">Bellingham Channel maximum flood and ebb</dt>
            <dd className="mt-1 text-xl text-sw-paper [font-variant-numeric:tabular-nums]">
              Within 9.7 minutes and 0.055 knots of NOAA
            </dd>
          </div>
        </dl>
        <p className="mt-6 max-w-2xl text-sw-steel">
          These July 2026 validation reports compare predictions at two stations, not measured
          water conditions. The current sample excludes slack timing.{' '}
          <a href="/accuracy/" className="underline underline-offset-4 hover:text-sw-foam">
            Read the dates, methods and limits
          </a>
          .
        </p>
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
        title={<>Bundled predictions, without a connection.</>}
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
          Bundled stations predict on your phone for any date, without a download or an expiring
          cache. Canadian stations need an initial download to build their offline model.
          Online-only passes need a connection and are labeled in the app.
        </p>
        <p>Thousands of stations ship inside the app.</p>
      </Feature>

      <section className="mt-24 border-t border-white/10 pt-10 sm:mt-28">
        <Heading>Free, open source, no account, no ads.</Heading>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-sw-foam">
          Tide charts, current predictions and home screen widgets are free. Choose any date
          without a subscription. Bundled stations work offline; Canadian stations need setup,
          and some passes require a connection. Your location stays on your phone.
        </p>
        <p className="mt-4 max-w-2xl text-sw-foam">
          Comparing tide apps? See how Slackwater&rsquo;s free charts and widgets compare with{' '}
          <a href="/alternatives/tide-guide/" className="underline underline-offset-4 hover:text-sw-paper">
            Tide Guide&rsquo;s Pro features
          </a>
          .
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

      <section id="app-facts" className="mt-24 border-t border-white/10 pt-10 sm:mt-28">
        <Heading>Questions about Slackwater.</Heading>
        <div className="mt-6 max-w-2xl space-y-7 text-sw-foam [&_h3]:font-semibold [&_h3]:text-sw-paper [&_p]:mt-2 [&_p]:leading-relaxed [&_a]:underline [&_a]:underline-offset-4">
          <div>
            <h3>What is Slackwater?</h3>
            <p>
              Slackwater is a tide and tidal currents app for planning time on the water or at
              its edge. Check high and low tides, current speed and direction, and slack-water
              times for a beach visit, fishing trip or passage.
            </p>
          </div>
          <div>
            <h3>Which devices does it support?</h3>
            <p>
              The public beta runs on iPhone and iPad with iOS or iPadOS 26 or later,
              and Apple Watch with watchOS 26 or later.{' '}
              <a href={TESTFLIGHT ?? '/support/'}>Get the beta through TestFlight</a>.
            </p>
          </div>
          <div>
            <h3>What is free?</h3>
            <p>
              Tide charts, current predictions, station search, favorites and home screen
              widgets are free, with no account or ads. You can choose any prediction date
              without a subscription. The Apple Watch app is free too. Optional Premium adds
              alerts, station calendars, lock-screen widgets and Watch complications, with
              annual and lifetime purchase options.
            </p>
          </div>
          <div>
            <h3>Does it work without a connection?</h3>
            <p>
              Bundled stations work offline from first launch. Supported Canadian stations
              need an initial download to build their offline model. Some Canadian passes
              require a connection and are labeled in the app. Set up your Canadian stations
              before leaving signal.
            </p>
          </div>
          <div>
            <h3>Where does Slackwater have coverage?</h3>
            <p>
              Tide stations are available around the world; current stations cover the US
              and Canada. Coverage varies by place. Browse the{' '}
              <a href="/stations/">station directory</a> to find your water.
            </p>
          </div>
          <div>
            <h3>Do I need to share my location?</h3>
            <p>
              No. Location permission helps find nearby stations, and your device&rsquo;s
              GPS coordinates stay on your device. You can search and browse without it.
              The app has no Open Waters account; favorites can sync through Apple&rsquo;s
              iCloud. The website counts visits without cookies. Read the{' '}
              <a href="/privacy/">privacy policy</a> for details.
            </p>
          </div>
          <div>
            <h3>Where can I get help or inspect the source?</h3>
            <p>
              <a href="/support/">Contact support</a> with the station name and date if a
              prediction looks wrong. The app&rsquo;s{' '}
              <a href={SOURCE}>source code is public</a>. Predictions are not observations;
              weather and river flow affect conditions. Slackwater is not for navigation.
            </p>
          </div>
        </div>
      </section>

      <footer className="mt-20 border-t border-white/10 pt-6 text-sm text-sw-steel">
        <p>
          Every station has its own page, so a link you send works for someone who hasn&rsquo;t
          installed anything:{' '}
          <a href="/tides/" className="underline underline-offset-4">
            5,893 tide stations
          </a>{' '}
          and{' '}
          <a href="/currents/" className="underline underline-offset-4">
            2,557 current stations
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
          .{' '}
          <a href="https://openwaters.io/tides/slackwater" className="underline underline-offset-4">
            Developers
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
