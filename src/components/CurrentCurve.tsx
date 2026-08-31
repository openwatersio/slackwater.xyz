import { useId, useMemo } from 'react'
import { dayLabel, hhmm } from '#/lib/format'
import { rampColor } from '#/lib/ramp'
import {
  findEvents,
  nextEvent,
  predictSeries,
  slackWindows,
  SLACK_KNOTS,
  type StationEvent,
} from '#/lib/predict'
import type { Station } from '#/lib/station'

/**
 * The signed velocity curve, drawn the way the app draws it.
 *
 * Colour is state, form is kind. The fill is the speed ramp — one horizontal
 * gradient across the whole curve, so colour reads as "how hard is it running"
 * and never as "what kind of station is this".
 *
 * Green is slack, and it makes two separate claims with two separate marks.
 * The BAND is what slack is set to: a flat rule from +threshold to -threshold
 * across the whole width, ground rather than figure, claiming nothing about
 * time. The INKED RUN is when it is happening: the curve itself, overdrawn
 * green between the window's crossings. Drawing the window on the water rather
 * than behind it means the mark cannot over-claim — a peak that rises out of
 * the band breaks the green — and makes two windows comparable by length
 * alone, which a mark whose height followed the curve's steepness was not.
 */

// ponytail: the app's SN.go. A literal, like the foam and ramp hexes below it —
// the tokens in styles.css can't reach the OG card, which resvg rasterises from
// bare markup with no stylesheet (see lib/og-image.ts).
const GO = '#88B868'

interface Props {
  station: Station
  start: Date
  hours: number
  now: Date
  /**
   * viewBox width. SVG text scales with the viewBox, so a 1000-wide box shrunk
   * into a 390px phone renders 15px labels at about 6px — unreadable. Narrow
   * the box on small screens instead of shrinking the type.
   */
  width?: number
  height?: number
  /** Drop the in-chart slack times, keeping only the peaks. */
  sparse?: boolean
  /**
   * Is `now` actually now? Only a hydrated client can say yes.
   *
   * The "next slack, in 30m" line is a claim about the present, and a
   * prerendered page makes it against a frozen build-time clock — a reading
   * that is days old and drifting, in the one place a reader without JS
   * (crawler, unfurl scraper) sees it. False here, that line does not render
   * server-side; the client re-renders it after hydration against the real
   * clock. Instant pages never set it: they show one fixed shared moment,
   * and "in 30m" from a moment that may be in the past is simply wrong.
   */
  live?: boolean
}

export function CurrentCurve({
  station,
  start,
  hours,
  now,
  width: W = 1000,
  height: H = 320,
  sparse = false,
  live = false,
}: Props) {
  // Unique per instance. The page renders this twice — a phone version and a
  // desktop one, one of them display:none — and shared element ids make the
  // second SVG reference the first's gradient, which sits in a hidden subtree
  // and paints nothing. The stroke survives, the fill silently vanishes.
  const uid = useId().replace(/:/g, '')
  const rampId = `ramp-${uid}`
  const maskId = `edges-${uid}`
  const fadeId = `fade-${uid}`
  const clipId = `plot-${uid}`
  const slackId = `slack-${uid}`

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, zeroY, x, yOf, events, stops, windows } = useMemo(() => {
    const samples = predictSeries(station, start, hours)
    const events = findEvents(station, start, hours)
    const windows = slackWindows(station, start, hours)
    const peak = Math.max(...samples.map((s) => Math.abs(s.level)), 1)

    const span = hours * 3600_000
    const x = (t: Date) => ((t.getTime() - start.getTime()) / span) * W
    const plot = H - PAD_TOP - PAD_BOTTOM
    const y = (k: number) => PAD_TOP + plot / 2 - (k / peak) * (plot / 2)

    const pts = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.level).toFixed(2)}`)

    // Gradient stops run along time, but each stop's COLOUR comes from that
    // moment's speed. A left-to-right ramp would colour by clock position,
    // which means nothing; this way the fill is dark at slack and bright in
    // the rip, and the same colour means the same knots on any day.
    const stops = samples.map((s) => ({
      offset: x(s.time) / W,
      color: rampColor(s.level),
    }))

    return {
      stops,
      windows,
      yOf: y,
      path: `M${pts.join('L')}`,
      area: `M${x(samples[0].time).toFixed(2)},${y(0)}L${pts.join('L')}L${x(samples[samples.length - 1].time).toFixed(2)},${y(0)}Z`,
      zeroY: y(0),
      x,
      events,
    }
  }, [station, start, hours])

  const next = nextEvent(events, now)
  // The fill fades out over the outer 6% at each end, so a label landing there
  // annotates a curve the reader can barely see and looks clipped. Drop it —
  // the window edge is arbitrary anyway.
  const inFrame = (e: StationEvent) => x(e.time) > W * 0.07 && x(e.time) < W * 0.93
  const slacks = events.filter((e) => e.kind === 'slack' && inFrame(e))
  const turns = events.filter((e) => e.kind !== 'slack' && inFrame(e))

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={describe(station, events, now)}
      >
        <defs>
          <linearGradient id={rampId} x1="0" x2="1" y1="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          {/* The window has to end somewhere; a hard vertical cut reads as a
              rendering fault, so let the fill fade out instead. */}
          {/* WHITE, not black: an SVG mask is luminance-based, so black hides
              and white reveals. Black stops here erase the entire curve. */}
          <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.06" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.94" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={maskId}>
            <rect x="0" y="0" width={W} height={H} fill={`url(#${fadeId})`} />
          </mask>
          {/* A clipPath unions its children, so every window fits in one. */}
          <clipPath id={slackId}>
            {windows.map((w) => (
              <rect key={w.start.getTime()} x={x(w.start)} y={0} width={x(w.end) - x(w.start)} height={H} />
            ))}
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <g mask={`url(#${maskId})`}>
            {/* The slack band: the threshold made visible everywhere at once, so
                it reads as a speed the reader can check any moment against. It
                claims nothing about time — the inked run does that. Under the
                fill, so a peak crossing the band occludes it rather than being
                tinted green; inside the mask, so it fades at the frame edges
                with everything else instead of ending in a hard vertical cut. */}
            <rect
              x={0}
              y={yOf(SLACK_KNOTS)}
              width={W}
              height={yOf(-SLACK_KNOTS) - yOf(SLACK_KNOTS)}
              fill={GO}
              // ponytail: 0.56 is the app's, settled by eye on a phone. Tune here.
              opacity={0.56}
            />
            <path d={area} fill={`url(#${rampId})`} opacity={0.9} />
            <path d={path} fill="none" stroke="#DFEEE0" strokeWidth={2.2} strokeLinejoin="round" />
            {/* The same curve, inked green where it is inside the band. Clipped
                rather than re-fitted: the clip's edges are the interpolated
                crossings, so the green starts and stops exactly where the water
                does and not at the nearest 10-minute sample. */}
            <g clipPath={`url(#${slackId})`}>
              <path d={path} fill="none" stroke={GO} strokeWidth={4.4} strokeLinejoin="round" />
            </g>
          </g>
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#FFFFFF" strokeOpacity={0.4} />

          {/* Max flood / max ebb — a dot and a number, ink picked by luminance. */}
          {turns.map((e) => (
            <g key={`t${e.time.getTime()}`}>
              <circle cx={x(e.time)} cy={yOf(e.level)} r={4} fill="#E4F0E4" />
              <text
                x={x(e.time)}
                y={yOf(e.level) + (e.level > 0 ? -14 : 22)}
                textAnchor="middle"
                // Foam, not speedInk: the label sits on the page, not on the
                // fill, so fill-contrast ink turns dark navy above ~6.6 kn and
                // vanishes. The curve already carries the speed as colour.
                fill="#E4F0E4"
                className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
              >
                {Math.abs(e.level).toFixed(1)} kn
              </text>
            </g>
          ))}

          {/* Slack instants: foam, never green. A mathematical point is not
              something you can transit at — the inked run is. Set smaller than
              the peak labels for the same reason: an instant rendered louder
              than its own window inverts the hierarchy. */}
          {slacks.map((s) => (
            <g key={`s${s.time.getTime()}`}>
              <circle cx={x(s.time)} cy={zeroY} r={4} fill="#E4F0E4" />
              {!sparse && (
              <text
                x={x(s.time)}
                y={zeroY - 14}
                textAnchor="middle"
                fill="#E4F0E4"
                fillOpacity={0.6}
                className="font-mono text-[12px] [font-variant-numeric:tabular-nums]"
                style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
              >
                {hhmm(s.time, station.timezone)}
              </text>
              )}
            </g>
          ))}

          {/* Now. */}
          <g>
            <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke={GO} strokeOpacity={0.9} strokeWidth={1.5} />
            <circle cx={x(now)} cy={zeroY} r={3} fill={GO} />
            {/* Top, not bottom: the bottom is where a max-ebb label lands, and
                on a phone the two collide. */}
            <text
              x={x(now)}
              y={12}
              textAnchor="middle"
              fill={GO}
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
            >
              Now
            </text>
          </g>
        </g>
      </svg>

      <figcaption className="sr-only">{describe(station, events, now)}</figcaption>

      {live && next && (
        <p className="mt-6 text-lg">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-sw-leaf">
            Next {next.kind === 'slack' ? 'slack' : `max ${next.kind}`}
          </span>
          <br />
          <span className="[font-variant-numeric:tabular-nums] text-sw-paper">
            {hhmm(next.time, station.timezone)}
          </span>
          <span className="text-sw-steel"> · in {until(next.time, now)}</span>
        </p>
      )}
    </figure>
  )
}

function until(then: Date, now: Date) {
  const mins = Math.max(0, Math.round((then.getTime() - now.getTime()) / 60_000))
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

/**
 * Spoken form, for anyone who can't see the curve. Units written in full, and
 * the event is dated: a bare `hh:mm` leaves a reader unable to tell which day.
 *
 * "Computed from harmonic constituents", not "computed on this device": this
 * same sentence ships in prerendered HTML, where no device computed anything.
 * The claim has to be true on both rendering paths. It names the event's own
 * day rather than calling it "next", for the same reason — nothing here knows
 * whether the reader is looking at this page now.
 */
function describe(station: Station, events: StationEvent[], now: Date) {
  const n = nextEvent(events, now)
  if (!n) return `Tidal current predictions for ${station.name}, computed from harmonic constituents.`
  const what =
    n.kind === 'slack'
      ? 'Slack water'
      : `Maximum ${n.kind} of ${Math.abs(n.level).toFixed(1)} knots`
  const tz = station.timezone
  return (
    `Tidal current at ${station.name}, computed from harmonic constituents. ` +
    `${what} on ${dayLabel(n.time, tz)} at ${hhmm(n.time, tz)}.`
  )
}
