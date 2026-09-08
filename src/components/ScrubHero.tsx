import { useMemo } from 'react'
import { CurrentScrubStrip } from './CurrentScrubStrip'
import { skyDays } from '#/lib/sky-state'
import { useScrubIntro } from '#/lib/use-scrub-intro'
import { useLiveNow } from '#/lib/use-live-now'
import { HERO_STATION } from '#/lib/currents'
import { TESTFLIGHT } from '#/lib/links'
import { hhmm } from '#/lib/format'

export function ScrubHero() {
  const { now, live } = useLiveNow()
  const { from, to, scrubTime, seconds } = useScrubIntro(HERO_STATION, now, live)
  const days = useMemo(
    () => skyDays(HERO_STATION.latitude, HERO_STATION.longitude,
      new Date(from.getTime() - 24 * 3600_000), new Date(to.getTime() + 24 * 3600_000)),
    [from, to],
  )

  return (
    <section className="relative w-full overflow-hidden" style={{ height: '100dvh', minHeight: 560 }}>
      <CurrentScrubStrip station={HERO_STATION} days={days} from={from} to={to}
        scrubTime={scrubTime} seconds={seconds} />

      <div className="absolute inset-x-0 top-0 flex justify-center px-5 pt-10 sm:pt-16">
        <div className="max-w-xl rounded-2xl border border-white/15 bg-sw-navy-deep/40 px-6 py-5 text-center backdrop-blur-sm">
          <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
            Slackwater
          </h1>
          <p className="mt-3 text-lg leading-snug text-sw-foam">
            All tide and current predictions, offline on your phone.
          </p>
          <div className="mt-5">
            {TESTFLIGHT ? (
              <a href={TESTFLIGHT}
                className="inline-block rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90">
                Get the beta on TestFlight
              </a>
            ) : (
              <span className="inline-block rounded-md border border-sw-leaf/30 px-5 py-3 font-medium text-sw-steel">
                iPhone beta — opening soon
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-0 px-5 pb-5 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sw-foam/70">
        <a href="/currents/deception-pass/" className="underline underline-offset-4">
          {HERO_STATION.name}
        </a>
        {/* Gated on `live`: a time in the prerendered HTML is stale by however long ago the site was built. */}
        {live ? <> · {hhmm(scrubTime, HERO_STATION.timezone)}</> : null}
        {' '}· computed in this browser
      </p>
    </section>
  )
}
