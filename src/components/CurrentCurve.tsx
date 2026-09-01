import { useId, useMemo } from 'react'
import { provenance } from '#/lib/copy'
import { dayLabel, hhmm } from '#/lib/format'
import { speedColor } from '#/lib/ramp'
import {
  findEvents,
  nextEvent,
  predictSeries,
  slackWindows,
  SLACK_KNOTS,
  type Sample,
  type StationEvent,
} from '#/lib/predict'
import type { BundledStation, ChsStation, Station } from '#/lib/station'

/**
 * The signed velocity curve, drawn the way the app draws it.
 *
 * Colour is state, form is kind.
 *
 * The fill is the app's speed ramp, and it starts at the COMFORT LIMIT rather
 * than at zero: only the excess above ±threshold is inked, yellow where it
 * leaves the band and red at the edge of the plot. Water you can work in is
 * not drawn hot at all. The gradient runs vertically against the auto-fitted
 * plot, exactly as `drawCurrent` runs it, so the day's peak is the red end
 * whatever it measures — see `speedColor`.
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

interface Common {
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

/**
 * Either a station whose curve we can compute, or a station whose curve
 * arrived from somewhere else — never a CHS station with neither.
 *
 * A union rather than two optional props, for the reason `Station` is a union:
 * `predictSeries` narrows to `BundledStation`, so a stub reaching the
 * prediction path is a compile error rather than a throw on every prerendered
 * Canadian page. Making `samples` merely optional would put that failure back
 * at runtime, or — worse — draw an empty curve.
 */
type Props = Common &
  (
    | { station: BundledStation; samples?: never; events?: never }
    | { station: ChsStation; samples: Sample[]; events: StationEvent[] }
  )

/**
 * The day's curve and the day's events, from whichever source this station has.
 *
 * A Canadian gate's events are DFO's own published slacks and maxima, so the
 * derived path is bypassed rather than duplicated: `findEvents` interpolates
 * slack from a sign change between samples, and DFO states the time outright.
 */
function curveOf(props: Props, start: Date, hours: number) {
  if (props.samples) return { samples: props.samples, events: props.events }
  return {
    samples: predictSeries(props.station, start, hours),
    events: findEvents(props.station, start, hours),
  }
}

export function CurrentCurve(props: Props) {
  const {
    station,
    start,
    hours,
    now,
    width: W = 1000,
    height: H = 320,
    sparse = false,
    live = false,
  } = props
  // Unique per instance. The page renders this twice — a phone version and a
  // desktop one, one of them display:none — and shared element ids make the
  // second SVG reference the first's gradient, which sits in a hidden subtree
  // and paints nothing. The stroke survives, the fill silently vanishes.
  const uid = useId().replace(/:/g, '')
  const hotUpId = `hot-up-${uid}`
  const hotDownId = `hot-down-${uid}`
  const hotAboveId = `above-${uid}`
  const hotBelowId = `below-${uid}`
  const maskId = `edges-${uid}`
  const fadeId = `fade-${uid}`
  const clipId = `plot-${uid}`
  const slackId = `slack-${uid}`

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, zeroY, x, yOf, events, windows } = useMemo(() => {
    const { samples, events } = curveOf(props, start, hours)
    const windows = slackWindows(samples)
    const peak = Math.max(...samples.map((s) => Math.abs(s.level)), 1)

    const span = hours * 3600_000
    const x = (t: Date) => ((t.getTime() - start.getTime()) / span) * W
    const plot = H - PAD_TOP - PAD_BOTTOM
    const y = (k: number) => PAD_TOP + plot / 2 - (k / peak) * (plot / 2)

    const pts = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.level).toFixed(2)}`)

    return {
      windows,
      yOf: y,
      path: `M${pts.join('L')}`,
      area: `M${x(samples[0].time).toFixed(2)},${y(0)}L${pts.join('L')}L${x(samples[samples.length - 1].time).toFixed(2)},${y(0)}Z`,
      zeroY: y(0),
      x,
      events,
    }
    // `props` itself would be a new object every render, and this page ticks:
    // the whole path would be rebuilt once a minute for a curve that has not
    // changed. The two fetched arrays are set once and never mutated.
  }, [station, props.samples, props.events, start, hours])

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
          {/* Vertical, in user space: the ramp is a position in the PLOT, not
              a speed, so the yellow end pins to the threshold line and the red
              end to the edge of the fitted plot. Two of them because the ebb
              half runs the other way. */}
          <linearGradient id={hotUpId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={yOf(SLACK_KNOTS)} y2={PAD_TOP}>
            <stop offset="0" stopColor={speedColor(0)} />
            <stop offset="0.5" stopColor={speedColor(0.5)} />
            <stop offset="1" stopColor={speedColor(1)} />
          </linearGradient>
          <linearGradient id={hotDownId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={yOf(-SLACK_KNOTS)} y2={H - PAD_BOTTOM}>
            <stop offset="0" stopColor={speedColor(0)} />
            <stop offset="0.5" stopColor={speedColor(0.5)} />
            <stop offset="1" stopColor={speedColor(1)} />
          </linearGradient>
          {/* The excess, without walking the samples for it: the area between
              the zero line and the curve, intersected with the half-plane
              outside the band, IS the area between the threshold line and the
              curve wherever the curve exceeds it. The clip edge lands on the
              exact crossing, which a sampled polygon would not. */}
          <clipPath id={hotAboveId}>
            <rect x={0} y={0} width={W} height={yOf(SLACK_KNOTS)} />
          </clipPath>
          <clipPath id={hotBelowId}>
            <rect x={0} y={yOf(-SLACK_KNOTS)} width={W} height={H - yOf(-SLACK_KNOTS)} />
          </clipPath>
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
            <g clipPath={`url(#${hotAboveId})`}>
              <path d={area} fill={`url(#${hotUpId})`} />
            </g>
            <g clipPath={`url(#${hotBelowId})`}>
              <path d={area} fill={`url(#${hotDownId})`} />
            </g>
            <path d={path} fill="none" stroke="#DFEEE0" strokeWidth={2.2} strokeLinejoin="round" />
            {/* The same curve, inked green where it is inside the band. Clipped
                rather than re-fitted: the clip's edges are the interpolated
                crossings, so the green starts and stops exactly where the water
                does and not at the nearest 10-minute sample. */}
            <g clipPath={`url(#${slackId})`}>
              <path d={path} fill="none" stroke={GO} strokeWidth={4.4} strokeLinejoin="round" />
            </g>
          </g>

          {/* Max flood / max ebb — a dot and a number, ink picked by luminance. */}
          {turns.map((e) => (
            <g key={`t${e.time.getTime()}`}>
              <circle cx={x(e.time)} cy={yOf(e.level)} r={4} fill="#E4F0E4" />
              <text
                x={x(e.time)}
                y={yOf(e.level) + (e.level > 0 ? -14 : 22)}
                textAnchor="middle"
                // Foam, always: the label sits on the page as often as on the
                // fill, and the app's own `SN.speedInk` contrast switch is for
                // a mark drawn inside the fill. The curve carries the speed.
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
                // Clear of the BAND, not of the zero line: the band's height is
                // the threshold, so a label pinned near zero sits inside it as
                // soon as the threshold grows. At 0.5 kn this is where it was.
                y={yOf(SLACK_KNOTS) - 8}
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
  if (!n) return `Tidal current predictions for ${station.name}, ${provenance(station)}.`
  const what =
    n.kind === 'slack'
      ? 'Slack water'
      : `Maximum ${n.kind} of ${Math.abs(n.level).toFixed(1)} knots`
  const tz = station.timezone
  return (
    `Tidal current at ${station.name}, ${provenance(station)}. ` +
    `${what} on ${dayLabel(n.time, tz)} at ${hhmm(n.time, tz)}.`
  )
}
