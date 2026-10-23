import { createFileRoute } from '@tanstack/react-router'
import { SlackFigure, TidesFigure } from '#/components/LearnFigures'
import { ANDROID_TESTERS, APP_STORE, MINIMUM_IOS, REQUIREMENT } from '#/lib/links'
import { SITE_DESCRIPTION } from '#/routes/__root'
import { ORGANIZATION_DESCRIPTION } from '#/lib/json-ld'

const CANONICAL = 'https://slackwater.xyz/'
const SOURCE = 'https://github.com/openwatersio/slackwater-ios'
const ORGANIZATION = 'https://openwaters.io/#organization'
const LANGUAGES = [
  ['en', '🇺🇸🇬🇧', 'English'],
  ['fr-CA', '🇫🇷🇨🇦', 'Français'],
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
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/index.md' }],
    meta: [
      { property: 'og:url', content: CANONICAL },
      {
        // Claims only what the page already claims: a free iOS app, no ratings
        // invented, no features the app doesn't ship. One graph so the site and
        // the app name the same publisher by `@id`. `name` matches openwaters.io's
        // own Organization; `legalName` is the App Store seller, spelled as Apple
        // shows it.
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              '@id': ORGANIZATION,
              name: 'Open Waters',
              legalName: 'Open Water Software LLC',
              description: ORGANIZATION_DESCRIPTION,
              address: {
                '@type': 'PostalAddress',
                streetAddress: '411 Walnut St #15547',
                addressLocality: 'Green Cove Springs',
                addressRegion: 'FL',
                postalCode: '32043',
                addressCountry: 'US',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'slackwater@openwaters.io',
                contactType: 'customer support',
                url: 'https://slackwater.xyz/contact/',
              },
              url: 'https://openwaters.io/',
              sameAs: ['https://github.com/openwatersio'],
            },
            {
              '@type': 'WebSite',
              '@id': `${CANONICAL}#website`,
              name: 'Slackwater',
              url: CANONICAL,
              publisher: { '@id': ORGANIZATION },
            },
            {
              '@type': 'MobileApplication',
              '@id': `${CANONICAL}#app`,
              name: 'Slackwater',
              description: SITE_DESCRIPTION,
              url: CANONICAL,
              image: 'https://slackwater.xyz/og.png',
              applicationCategory: 'UtilitiesApplication',
              operatingSystem: `iOS ${MINIMUM_IOS} or later; iPadOS ${MINIMUM_IOS} or later`,
              installUrl: APP_STORE,
              sameAs: [APP_STORE, SOURCE],
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              publisher: { '@id': ORGANIZATION },
            },
          ],
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
  return (
    <a
      href={APP_STORE}
      className="inline-block rounded-full bg-sw-leaf px-6 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
    >
      Download on the App Store
    </a>
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
/** The moments people open a tide app in, each answered with what Slackwater
 *  does there. A card links only once its page exists; `href` is absent until
 *  then. */
const SITUATIONS: {
  title: string
  who: string
  body: string
  /** The scene, an illustration; decorative, so its alt is empty. */
  art: string
  shot: string
  alt: string
  href?: string
}[] = [
  {
    title: 'Anchored, no bars',
    art: '/shots/situations/boat.webp',
    who: 'Sailing and cruising',
    body: 'Your phone roamed and every tide app is spinning. Slackwater predicts on your phone, so the week of turns at the next pass is already there.',
    shot: '/shots/boating/currents-boat.webp',
    alt: 'Deception Pass at 3:00pm with the comfort current at 2 knots: slack in 6 minutes, with the windows a boat can use marked in green on the curve.',
    href: '/boating/',
  },
  {
    title: 'When’s the lowest daylight low?',
    art: '/shots/situations/tidepools.webp',
    who: 'Tide pools and beaches',
    body: 'Slackwater marks the fortnight’s lowest low and puts sunrise and sunset on the same timeline, so you can see whether it falls in daylight. Spring tides are labelled.',
    shot: '/shots/tide-pools/tides-lowest.webp',
    alt: 'Friday Harbor at its lowest low of the fortnight, 12:31pm on Sunday 6 June 2027, with sunrise and sunset on the timeline.',
    href: '/tide-pools/',
  },
  {
    title: 'Is the pass slow enough for me?',
    art: '/shots/situations/kayak.webp',
    who: 'Sea kayaking',
    body: 'Set the fastest current you’ll paddle in, and every curve shows your slack windows in green.',
    shot: '/shots/kayak/currents-comfort.webp',
    alt: 'Discovery Island’s current off Oak Bay with a 1.4 knot comfort current: slack windows in green between faster runs in blue.',
    href: '/kayak/',
  },
]

/** One situation: the reader's question, the screenshot that answers it
 *  (its top, where the reading and curve are), and two sentences. */
function SituationCard({ title, who, body, art, shot, alt, href }: (typeof SITUATIONS)[number]) {
  const card = (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-sw-canvas ring-1 ring-white/10 transition">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={art}
          alt=""
          loading="lazy"
          width={960}
          height={720}
          className="h-full w-full object-cover motion-safe:animate-drift"
        />
        {/* The app's answer, inset over the scene: the station through its
            timeline, cropped from the full screenshot. */}
        <div className="absolute bottom-4 right-4 aspect-square w-[38%] overflow-hidden rounded-2xl shadow-2xl shadow-sw-navy-deep/70 ring-1 ring-white/20">
          <img src={shot} alt={alt} loading="lazy" width={780} height={1695} className="h-full w-full object-cover object-[50%_21%]" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">{who}</p>
        <h3 className="mt-2 text-xl font-semibold leading-snug text-sw-paper">{title}</h3>
        <p className="mt-3 leading-relaxed text-sw-foam">{body}</p>
        {href && (
          <p className="mt-auto pt-4 font-medium text-sw-foam">
            Read more <span aria-hidden>→</span>
          </p>
        )}
      </div>
    </article>
  )
  return href ? (
    <a href={href} className="block rounded-3xl hover:[&>article]:ring-white/30">
      {card}
    </a>
  ) : (
    card
  )
}

/** A link into a visual guide: a small figure and one line, about half a
 *  situation card's height, so the guides read as further reading rather
 *  than another situation. */
function LearnCard({ href, title, body, figure }: { href: string; title: string; body: string; figure: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-sw-canvas ring-1 ring-white/10 transition hover:ring-white/30"
    >
      <div className="flex aspect-[8/3] items-center justify-center overflow-hidden bg-sw-navy-deep/40 px-6 py-3 [&>svg]:h-full [&>svg]:w-auto">{figure}</div>
      <div className="p-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">Visual guide</p>
        <h3 className="mt-1 font-semibold leading-snug text-sw-paper">
          {title} <span aria-hidden>→</span>
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-sw-steel">{body}</p>
      </div>
    </a>
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
          <div className="mt-8">
            <Cta />
          </div>
          <p className="mt-4 text-sm text-sw-steel">Free. Open source. No account, no ads.</p>
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
              aria-label="Friday Harbor in Slackwater sliding from afternoon into a full-moon night."
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

      {/* Kept below the recording so a phone's first screen holds only the
          promise, the download button and the app itself. */}
      <div className="mx-auto mt-8 max-w-2xl text-center">
        <p className="text-sm leading-relaxed text-sw-steel">
          Canadian stations need an initial download. Some passes require a connection;
          the app tells you which.
        </p>
        <p className="mt-2 text-sm text-sw-steel">
          {REQUIREMENT} On Android?{' '}
          <a href={ANDROID_TESTERS} className="underline underline-offset-4 hover:text-sw-foam">
            Join the testers
          </a>{' '}
          to get early builds.
        </p>
      </div>

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

      <section className="mt-24 sm:mt-28">
        <Heading>Where are you headed?</Heading>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SITUATIONS.map((s) => (
            <SituationCard key={s.title} {...s} />
          ))}
        </div>
      </section>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        <LearnCard
          href="/learn/tides/"
          title="Learn how tides work"
          body="Why the Moon makes two high tides a day, one step at a time."
          figure={<TidesFigure />}
        />
        <LearnCard
          href="/learn/slack-water/"
          title="What is slack water?"
          body="The window around the turn of a current, and why it isn't high or low tide."
          figure={<SlackFigure />}
        />
      </div>

      <section className="mt-16 border-t border-white/10 pt-10 sm:mt-20">
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

      <section className="mt-24">
        <div className="max-w-xl">
          <Heading>On your home screen and your wrist, free.</Heading>
          <Prose>
            <p>
              Home screen widgets show the next high, low or slack and today&rsquo;s curve, for
              where you are or a station you pick. The Apple Watch app works without your
              phone: turn the Digital Crown to move through the day. Both are free.
            </p>
            <p>
              Long-press your home screen, tap +, and search for Slackwater.{' '}
              <a href="/pricing/" className="underline underline-offset-4 hover:text-sw-foam">
                Premium
              </a>{' '}
              adds lock-screen widgets and Watch complications.
            </p>
          </Prose>
        </div>
        {/* The home screen is a device capture, cropped to the widgets; the
            watch frame comes from the watch App Store walk. */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          <figure className="m-0 w-full max-w-[390px]">
            <img
              src="/shots/widgets/home-screen.webp"
              alt="An iPhone home screen with two Slackwater widgets: Oak Bay's tide at 7.9 feet and falling, and Nakwakto Rapids flooding north at 4.3 knots with the day's maximums and slacks on its curve."
              loading="lazy"
              width={780}
              height={801}
              className="w-full rounded-[2rem] shadow-2xl shadow-sw-navy-deep/60 ring-1 ring-white/10"
            />
            <figcaption className="mt-4 text-sm leading-relaxed text-sw-steel">
              Oak Bay&rsquo;s tide and Nakwakto Rapids, on the home screen.
            </figcaption>
          </figure>
          <figure className="m-0 w-[200px]">
            <img
              src="/shots/watch/watch-tide.webp"
              alt="Friday Harbor on Apple Watch, turned with the Digital Crown to 3:49pm: 6.1 feet and rising toward a 6.9 foot high at 5:31pm."
              loading="lazy"
              width={422}
              height={514}
              className="w-full rounded-[28%/23%] shadow-2xl shadow-sw-navy-deep/60 ring-1 ring-white/10"
            />
            <figcaption className="mt-4 text-sm leading-relaxed text-sw-steel">
              On the watch, the Digital Crown moves through the day.
            </figcaption>
          </figure>
        </div>
      </section>

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
        <p className="mt-4 text-sm text-sw-steel">{REQUIREMENT}</p>
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
              Slackwater runs on iPhone and iPad with iOS or iPadOS {MINIMUM_IOS} or later,
              and Apple Watch with watchOS 26 or later.{' '}
              <a href={APP_STORE}>Download on the App Store</a>.
            </p>
          </div>
          <div>
            <h3>Is there an Android version?</h3>
            <p>
              An Android version is in development. Join the{' '}
              <a href={ANDROID_TESTERS}>Slackwater Android testers group</a> with the Google
              account you use on your phone, and you will get test builds through Google Play
              as they become available.
            </p>
          </div>
          <div>
            <h3>What is free?</h3>
            <p>
              Tide charts, current predictions, station search, favorites and home screen
              widgets are free, with no account or ads. You can choose any prediction date
              without a subscription. The Apple Watch app is free too. Optional Premium adds
              alerts, station calendars, lock-screen widgets and Watch complications, with
              annual and lifetime purchase options. <a href="/pricing/">See pricing and purchase terms</a>.
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

      <section className="mt-20 border-t border-white/10 pt-6 text-sm text-sw-steel">
        <p>
          Every station has its own page, so a link you send works for someone who hasn&rsquo;t
          installed anything:{' '}
          <a href="/tides/" className="underline underline-offset-4">
            6,761 tide stations
          </a>{' '}
          and{' '}
          <a href="/currents/" className="underline underline-offset-4">
            2,557 current stations
          </a>
          .
        </p>
      </section>
    </main>
  )
}
