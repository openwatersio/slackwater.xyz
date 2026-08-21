import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CurrentCurve } from '#/components/CurrentCurve'
import { HERO_STATION } from '#/lib/currents'

export const Route = createFileRoute('/')({ component: Home })

const TESTFLIGHT = 'https://testflight.apple.com/join/HK7mHF19'

/** Mono eyebrow — the app's MonoLabel: uppercase, tracked out, leaf green. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.7rem] font-medium uppercase tracking-[0.16em] text-sw-leaf">
      {children}
    </span>
  )
}

function Home() {
  // Prerender happens at build time, so the curve must re-centre on the real
  // "now" once it reaches a browser. Until then it renders the same day the
  // build did — correct shape, stale marker — rather than nothing at all.
  const [now, setNow] = useState(() => new Date('2026-08-21T12:00:00Z'))
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const start = new Date(now.getTime() - 6 * 3600_000)

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-16 sm:pt-24">
      <header>
        <h1 className="whitespace-nowrap text-5xl font-semibold tracking-tight text-sw-paper sm:text-6xl">
          Slackwater
        </h1>
        <p className="mt-5 max-w-xl text-xl leading-snug text-sw-foam">
          Every tide and current prediction, already on your phone. Works on the water, on the
          beach, in the anchorage — with no bars and nothing to load.
        </p>
      </header>

      <section
        className="mt-14 rounded-lg border border-sw-leaf/15 bg-white/[0.04] p-5 sm:p-7"
        aria-labelledby="hero-station"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>Right now · {HERO_STATION.name}</Eyebrow>
          <Eyebrow>Computed in this browser</Eyebrow>
        </div>

        <h2 id="hero-station" className="sr-only">
          Live tidal current at {HERO_STATION.name}
        </h2>

        <div className="mt-4">
          <CurrentCurve start={start} hours={24} now={now} />
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-sw-steel">
          Nothing was fetched to draw this. It is the harmonic sum for{' '}
          {HERO_STATION.name}, computed here, the same way the app computes it with no signal
          at all. Colour is speed — dark at slack, bright where it runs hard — on a scale fixed
          to what a boat can actually do, not to the day&rsquo;s own range.
        </p>
      </section>

      <section className="mt-14 flex flex-wrap items-center gap-4">
        <a
          href={TESTFLIGHT}
          className="rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          Get the beta on TestFlight
        </a>
        <a
          href="https://web.slackwater.xyz"
          className="text-sw-foam underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam"
        >
          Or just look at the water now
        </a>
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
          .
        </p>
      </footer>
    </main>
  )
}
