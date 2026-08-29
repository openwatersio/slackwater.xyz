import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CurrentCurve } from '#/components/CurrentCurve'
import { Shot } from '#/components/Shot'
import { HERO_STATION } from '#/lib/currents'

export const Route = createFileRoute('/')({ component: Home })

/**
 * The public beta link — TestFlight group "OSS and Externals", minted for this.
 *
 * NOT the Friends & Family link in slackwater-ios/docs/testflight.md. That one
 * is handed out personally; publishing it turns a curated group into an open
 * door and burns the only link that can be given to someone individually.
 */
const TESTFLIGHT: string | null = 'https://testflight.apple.com/join/FCSS4w8s'

/**
 * No web-client link right now.
 *
 * Two reasons, either sufficient: `web.slackwater.xyz` is the decided home but
 * has no DNS record yet, and the existing PWA at slackwater.sailingnaturali.com
 * has a broken "use my location". Sending someone to a demo whose first action
 * fails is worse than not offering the demo — this page's whole argument is that
 * the thing works when you need it.
 *
 * Restore when the web client is fixed or rebuilt (move-or-rebuild is still
 * open: slackwater/docs/superpowers/specs/2026-07-20-web-client-design.md).
 */
const WEB_CLIENT: string | null = null

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-sw-leaf sm:text-[0.7rem] sm:tracking-[0.16em]">
      {children}
    </span>
  )
}

function WebClientLink({ className = '' }: { className?: string }) {
  if (!WEB_CLIENT) return null
  return (
    <a
      href={WEB_CLIENT}
      className={`text-sw-foam underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam ${className}`}
    >
      Or just look at the water now
    </a>
  )
}

function Cta() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {TESTFLIGHT ? (
        <a
          href={TESTFLIGHT}
          className="rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          Get the beta on TestFlight
        </a>
      ) : (
        <span className="rounded-md border border-sw-leaf/30 px-5 py-3 font-medium text-sw-steel">
          iPhone beta — opening soon
        </span>
      )}
      {/* Desktop only. On a phone the fold is scarce and belongs to the
          primary action; the alternative reads fine after the chart. */}
      <WebClientLink className="hidden sm:inline" />
    </div>
  )
}

function Home() {
  const [now, setNow] = useState(() => new Date('2026-08-21T12:00:00Z'))
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 sm:pt-24">
      <header>
        <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-sw-paper sm:text-6xl">
          Slackwater
        </h1>
        {/* Short on phones, the full App Store line on desktop: the phone has
            to fit a headline, a claim, the CTA and the curve above the fold. */}
        <p className="mt-3 max-w-xl text-lg leading-snug text-sw-foam sm:mt-5 sm:text-xl">
          All tide and current predictions, offline on your phone.
          <span className="hidden sm:inline">
            {' '}
            Works on the water, on the beach, in the anchorage — no bars and nothing to load.
          </span>
        </p>
      </header>

      {/* Above the curve, deliberately. The chart is the argument, but the
          argument shouldn't stand between a convinced reader and the download. */}
      <div className="mt-6 sm:mt-8">
        <Cta />
      </div>

      <section
        className="mt-8 rounded-lg border border-sw-leaf/15 bg-white/[0.04] p-4 sm:mt-12 sm:p-7"
        aria-labelledby="hero-station"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Eyebrow>{HERO_STATION.name}</Eyebrow>
          <Eyebrow>Computed in this browser</Eyebrow>
        </div>

        <h2 id="hero-station" className="sr-only">
          Live tidal current at {HERO_STATION.name}
        </h2>

        {/* Two renderings rather than a resize listener: both prerender, so
            there is no hydration mismatch and no layout jump. The phone gets a
            12-hour window in a narrow viewBox — fewer events, readable type. */}
        <div className="mt-3 sm:hidden">
          <CurrentCurve
            start={new Date(now.getTime() - 3 * 3600_000)}
            hours={12}
            now={now}
            width={460}
            height={210}
            sparse
          />
        </div>
        <div className="mt-4 hidden sm:block">
          <CurrentCurve start={new Date(now.getTime() - 6 * 3600_000)} hours={24} now={now} />
        </div>

        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-sw-steel">
          Nothing was fetched to draw this — it is the harmonic sum for {HERO_STATION.name},
          computed here, the same way the app computes it with no signal at all.
          <span className="hidden sm:inline">
            {' '}
            Colour is speed — dark at slack, bright where it runs hard — on a scale fixed to
            what a boat can actually do, not to the day&rsquo;s own range.
          </span>
        </p>
      </section>

      <p className="mt-6 sm:hidden">
        <WebClientLink />
      </p>

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
          <div className="max-w-[260px] sm:w-[260px]">
            <Shot
              src="/shots/m2-current-scrubbed.webp"
              alt="Deception Pass Narrows in the app: slack under 0.1 knots, next slack in 6 hours 8 minutes, and a scrubable current curve showing 4.9 and 5.3 knot floods against 6.9 and 6.0 knot ebbs."
              caption="Deception Pass (Narrows). Slack now, next slack in 6h 8m, and what it does in between."
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
          <div className="max-w-[260px] sm:w-[260px]">
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
          <dl className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-2">
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
          <div className="max-w-[260px] sm:w-[260px]">
            <Shot
              src="/shots/m41-map-zoom.webp"
              alt="The app's chart of the Salish Sea, densely covered with tide stations as blue squares and current stations as orange circles, with place names from Sechelt Rapids and Squamish down past Seattle to Budd Inlet."
              caption="The Salish Sea: blue squares are tide stations, orange circles are currents. Every one of them predicts without a connection."
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
          <div className="max-w-[260px] sm:w-[260px]">
            <Shot
              src="/shots/list-located.webp"
              alt="The app's list located at Friday Harbor: a My Location card reading 1.1 feet and falling with a low of 0.8 feet at 12:06 PM, then Near Me — Point George, Wasp Passage narrows, Pear Point and Upright Channel narrows — each in knots with its set, whether it is ebbing or flooding, its next slack or max, and how many nautical miles away it is."
              caption="Located at Friday Harbor: the harbour&rsquo;s height on top, four nearby passes under it, nearest first."
            />
          </div>
        </div>
      </section>

      <section className="mt-20 rounded-lg border border-sw-leaf/20 bg-white/[0.04] p-6 sm:mt-28 sm:p-8">
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
          <a href="https://sailingnaturali.com" className="underline underline-offset-4">
            Sailing Naturali
          </a>
          .{' '}
          <a href="/privacy" className="underline underline-offset-4">
            Privacy
          </a>
          .{' '}
          <a href="/support" className="underline underline-offset-4">
            Support
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
