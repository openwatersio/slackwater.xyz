import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CurrentCurve } from '#/components/CurrentCurve'
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
 * The web client, today. `web.slackwater.xyz` is the decided home but has no DNS
 * record yet — it waits on the move-or-rebuild call (infrastructure/dns.md
 * § slackwater.xyz). Point at the live PWA until then; a dead link on the page
 * that sells "it just works" is worse than an off-brand hostname.
 */
const WEB_CLIENT = 'https://slackwater.sailingnaturali.com'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-sw-leaf sm:text-[0.7rem] sm:tracking-[0.16em]">
      {children}
    </span>
  )
}

function WebClientLink({ className = '' }: { className?: string }) {
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
          Every tide and current prediction, already on your phone.
          <span className="hidden sm:inline">
            {' '}
            Works on the water, on the beach, in the anchorage — with no bars and nothing to
            load.
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

      <footer className="mt-16 border-t border-white/10 pt-6 text-sm text-sw-steel">
        <p>
          Predictions are not observations — conditions vary with weather and river flow.{' '}
          <strong className="font-semibold text-sw-foam">Not for navigation.</strong>
        </p>
        <p className="mt-3">
          Built by{' '}
          <a href="https://sailingnaturali.com" className="underline underline-offset-4">
            Sailing Naturali
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
