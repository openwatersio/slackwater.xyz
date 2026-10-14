import { SlackTideChart } from './SlackTideChart'
import { chartTime } from '#/lib/format'
import { APP_STORE } from '#/lib/links'
import { GUIDE_DAYS, type SlackGuide } from '#/lib/slack-guide'

export const TITLE = 'What is slack water?'

/** "1 h 10 min", "54 min". */
function span(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`
}

/** "Thursday, October 15", in the station's zone. */
const longDay = (t: number, timeZone: string) =>
  new Date(t).toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' })

const EYEBROW = 'text-sm font-medium uppercase tracking-[0.16em] text-sw-steel'
const H2 = 'mt-3 text-3xl font-semibold tracking-tight text-sw-paper sm:text-4xl'
const PROSE = 'mt-5 space-y-4 text-lg leading-relaxed text-sw-foam'
const LINK = 'underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam'

export function SlackWaterGuide({ guide }: { guide: SlackGuide }) {
  const { comparison: c, durations, slackKnots } = guide
  const tz = c.timezone
  const { callout } = c.day
  const gap = Math.abs(callout.extreme - callout.slack) / 60_000
  const pass = durations.find((d) => d.path === c.current.path)
  const from = longDay(guide.now, tz)

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="flex items-center justify-between gap-4">
        <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
          Slackwater
        </a>
        <span className="text-sm text-sw-steel">Slack water</span>
      </nav>

      <article className="mx-auto max-w-3xl">
        <header className="mt-16 sm:mt-24">
          <p className={EYEBROW}>The water this site is named for</p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-sw-paper sm:text-6xl">
            {TITLE}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-sw-foam sm:text-xl">
            Slack water is the short stretch of time when a tidal current turns around. The flood
            slows, stops, and the ebb begins, or the other way round, and for a while the water
            barely moves. In a narrow pass, that lull is when a small boat can get through.
          </p>
        </header>

        <section className="mt-16 sm:mt-20">
          <p className={EYEBROW}>A window, not a moment</p>
          <h2 className={H2}>Slack is the time the stream is weak enough to work with</h2>
          <div className={PROSE}>
            <p>
              The current is exactly zero for an instant. What matters on the water is the time
              around that instant, while the stream is too weak to set you onto the rocks or stop
              you making way.
            </p>
            <p>
              There is no single speed that counts as slack. Slackwater&rsquo;s station pages
              treat anything under {slackKnots} knots as slack and draw it green. The app starts at
              0.5 knots and lets you set your own, because a kayak and a trawler don&rsquo;t share
              a limit.
            </p>
          </div>
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="not-high-tide">
          <p className={EYEBROW}>The common mistake</p>
          <h2 id="not-high-tide" className={H2}>
            Slack is not high or low tide
          </h2>
          <div className={PROSE}>
            <p>
              It&rsquo;s natural to assume the current stops at high and low tide. Along an open
              coast it roughly does. In a pass it often doesn&rsquo;t: the stream there runs on the
              difference in water level between the two ends, and it turns when that difference
              does, not when the tide peaks on either side.
            </p>
            <p>
              <a href={c.tide.path} className={LINK}>
                {c.tide.name}
              </a>{' '}
              has a tide gauge {c.distanceNm.toFixed(1)} nautical miles from{' '}
              <a href={c.current.path} className={LINK}>
                {c.current.name}
              </a>
              . On {longDay(c.day.start, tz)}, slack in the pass came at{' '}
              {chartTime(new Date(callout.slack), tz)}, {span(gap)}{' '}
              {callout.slack < callout.extreme ? 'before' : 'after'}{' '}
              {callout.high ? 'high' : 'low'} water at the gauge.
            </p>
          </div>
        </section>
      </article>

      <figure className="mx-auto mt-10 max-w-4xl rounded-2xl border border-white/10 bg-sw-canvas px-3 py-5 sm:px-6">
        <div className="sm:hidden">
          <SlackTideChart comparison={c} slackKnots={slackKnots} width={420} />
        </div>
        <div className="hidden sm:block">
          <SlackTideChart comparison={c} slackKnots={slackKnots} />
        </div>
        <figcaption className="mt-3 px-2 text-sm leading-relaxed text-sw-steel">
          {longDay(c.day.start, tz)}, times local to the pass. Dashed lines are the gauge&rsquo;s
          highs and lows; solid green lines are slack in the pass. The dotted green lines mark{' '}
          {slackKnots} knots either way, and the curve turns green while the current stays between
          them.
        </figcaption>
      </figure>

      <article className="mx-auto max-w-3xl">
        <div className={PROSE}>
          <p>
            That day is not unusual. Over the {GUIDE_DAYS} days from {from}, {c.fortnight.within30}{' '}
            of the {c.fortnight.slacks} slacks in Deception Pass fall within half an hour of a high
            or low at the gauge. {c.fortnight.overHour} are an hour or more from one, and the
            furthest is {span(c.fortnight.maxMinutes)} away.
          </p>
          <p>
            A tide table read as a slack table gets a pass wrong. Current stations publish their
            own slack times, so use the current station for the water you are crossing.
          </p>
        </div>

        <section className="mt-16 sm:mt-20" aria-labelledby="how-long">
          <p className={EYEBROW}>Minutes or hours</p>
          <h2 id="how-long" className={H2}>
            How long slack lasts
          </h2>
          <div className={PROSE}>
            <p>
              It depends on the pass and on the size of the exchange. A narrow pass with a fast
              stream swings from flood to ebb with hardly a pause; a broad channel with a weaker
              stream can idle under the band for hours. These are the next {GUIDE_DAYS} days at
              each station, counting slack as under {slackKnots} knots:
            </p>
          </div>
          {/* A phone gets one block per station: five columns do not fit 360 px. */}
          <ul className="mt-6 space-y-4 sm:hidden">
            {durations.map((d) => (
              <li key={d.path} className="border-t border-sw-steel/20 pt-3 text-sw-foam">
                <a href={d.path} className={LINK}>
                  {d.name}
                </a>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                  <dt className="text-sw-steel">Fastest stream</dt>
                  <dd>{d.peakKnots.toFixed(1)} kn</dd>
                  <dt className="text-sw-steel">Typical slack</dt>
                  <dd>{span(d.medianMinutes)}</dd>
                  <dt className="text-sw-steel">Shortest</dt>
                  <dd>{span(d.shortest.minutes)}</dd>
                  <dt className="text-sw-steel">Longest</dt>
                  <dd>{span(d.longest.minutes)}</dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-6 hidden sm:block">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wider text-sw-leaf">
                <tr>
                  <th className="py-2 pr-4 font-medium">Station</th>
                  <th className="py-2 pr-4 font-medium">Fastest stream</th>
                  <th className="py-2 pr-4 font-medium">Typical slack</th>
                  <th className="py-2 pr-4 font-medium">Shortest</th>
                  <th className="py-2 font-medium">Longest</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-sw-foam">
                {durations.map((d) => (
                  <tr key={d.path} className="border-t border-sw-steel/20">
                    <td className="py-2 pr-4">
                      <a href={d.path} className={LINK}>
                        {d.name}
                      </a>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">{d.peakKnots.toFixed(1)} kn</td>
                    <td className="whitespace-nowrap py-2 pr-4">{span(d.medianMinutes)}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{span(d.shortest.minutes)}</td>
                    <td className="whitespace-nowrap py-2">{span(d.longest.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pass && (
            <div className={PROSE}>
              <p>
                Even at one station the window moves with the tide&rsquo;s range. At Deception Pass
                the shortest slack in that stretch, {span(pass.shortest.minutes)} on{' '}
                {longDay(pass.shortest.start, tz)}, sits between streams reaching{' '}
                {pass.shortest.flankKnots.toFixed(1)} knots. The longest,{' '}
                {span(pass.longest.minutes)} on {longDay(pass.longest.start, tz)}, sits between
                streams reaching {pass.longest.flankKnots.toFixed(1)} knots.
                {pass.shortest.flankKnots > pass.longest.flankKnots &&
                  ' A bigger exchange means a faster stream and a shorter slack.'}
              </p>
            </div>
          )}
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="when-to-go">
          <p className={EYEBROW}>Planning a transit</p>
          <h2 id="when-to-go" className={H2}>
            When to go
          </h2>
          <div className={PROSE}>
            <p>
              Each turn has two slacks on a current table: slack before flood, as the ebb dies, and
              slack before ebb, as the flood dies. Pick the one that leaves the next stream running
              your way. Arrive as the opposing stream eases, go through at the turn, and the new
              stream carries you on rather than building against you.
            </p>
            <p>
              Plan around the window, not the minute. Predictions are not observations: wind,
              river runoff and air pressure can move slack by minutes or more. Be at the entrance
              when the window opens, not when it peaks, and know where you will wait if the
              stream turns early.
            </p>
          </div>
        </section>

        <section className="mt-16 sm:mt-20" aria-labelledby="where">
          <p className={EYEBROW}>Next</p>
          <h2 id="where" className={H2}>
            Where to find slack water
          </h2>
          <div className={PROSE}>
            <p>
              Every{' '}
              <a href="/currents/" className={LINK}>
                current station
              </a>{' '}
              on this site draws the day&rsquo;s slack window green on its curve, and the NOAA
              stations list the next seven days of slacks and maximums.
            </p>
            <p>
              The{' '}
              <a href={APP_STORE} className={LINK}>
                Slackwater app
              </a>{' '}
              draws the same window for every current station on your phone, at the slack speed
              you choose.
            </p>
          </div>
        </section>

        <footer className="mt-20 border-t border-white/10 pt-6 text-sm leading-relaxed text-sw-steel">
          <p>
            Every number on this page is computed from the site&rsquo;s own predictions, from NOAA
            harmonic constituents, starting {from}. Predictions are not observations, and conditions
            vary with weather and river flow.{' '}
            <strong className="font-semibold text-sw-foam">Not for navigation.</strong> See{' '}
            <a href="/accuracy/" className={LINK}>
              how accurate the predictions are
            </a>{' '}
            and{' '}
            <a href="/learn/tides/" className={LINK}>
              how the Moon makes the tide
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  )
}
