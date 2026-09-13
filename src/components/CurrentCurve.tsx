import { useId, useMemo } from 'react'
import { provenance } from '#/lib/copy'
import { daylightSpans } from '#/lib/daylight'
import { fadeStops } from '#/lib/fade'
import { chartTime, dayLabel, hhmm } from '#/lib/format'
import { timeAtFraction } from './TideCurve'
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
 * The app's blue fill fades to clear at zero and intensifies equally toward
 * flood and ebb. Green belongs only to actual slack runs on the line; each
 * peak hangs its speed and set arrow inside the lobe.
 */

// ponytail: the app's SN.go. A literal, like the other SVG inks below it —
// the tokens in styles.css can't reach the OG card, which resvg rasterises from
// bare markup with no stylesheet (see lib/og-image.ts).
const GO = '#88B868'

interface Common {
  start: Date
  hours: number
  now: Date
  actualNow?: Date
  trackingNow?: boolean
  onSelect?: (at: Date) => void
  onCommit?: (at: Date) => void
  /**
   * viewBox width. SVG text scales with the viewBox, so a 1000-wide box shrunk
   * into a 390px phone renders 15px labels at about 6px — unreadable. Narrow
   * the box on small screens instead of shrinking the type.
   */
  width?: number
  height?: number
  /** Drop the in-chart slack times, keeping only the peaks. */
  sparse?: boolean
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
    actualNow,
    trackingNow = false,
    onSelect,
    onCommit,
    width: W = 1000,
    height: H = 320,
    sparse = false,
  } = props
  // Unique per instance. The page renders this twice — a phone version and a
  // desktop one, one of them display:none — and shared element ids make the
  // second SVG reference the first's gradient, which sits in a hidden subtree
  // and paints nothing. The stroke survives, the fill silently vanishes.
  const uid = useId().replace(/:/g, '')
  const fillId = `fill-${uid}`
  const areaId = `area-${uid}`
  const maskId = `edges-${uid}`
  const fadeId = `fade-${uid}`
  const clipId = `plot-${uid}`
  const slackId = `slack-${uid}`

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, zeroY, x, yOf, events, windows, samples } = useMemo(() => {
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
      samples,
    }
    // `props` itself would be a new object every render, and this page ticks:
    // the whole path would be rebuilt once a minute for a curve that has not
    // changed. The two fetched arrays are set once and never mutated.
  }, [station, props.samples, props.events, start, hours])

  // The fill fades out over the outer 6% at each end, so a label landing there
  // annotates a curve the reader can barely see and looks clipped. Drop it —
  // the window edge is arbitrary anyway.
  const inFrame = (e: StationEvent) => x(e.time) > W * 0.07 && x(e.time) < W * 0.93
  const slacks = events.filter((e) => e.kind === 'slack' && inFrame(e))
  const turns = events.filter((e) => e.kind !== 'slack' && inFrame(e))
  const end = new Date(start.getTime() + hours * 3600_000)
  const daylight = useMemo(
    () => daylightSpans(start, end, station.latitude, station.longitude),
    [station.latitude, station.longitude, start.getTime(), end.getTime()],
  )
  const actualSample = actualNow && actualNow >= start && actualNow <= end
    ? samples.reduce((best, sample) =>
        Math.abs(sample.time.getTime() - actualNow.getTime()) < Math.abs(best.time.getTime() - actualNow.getTime())
          ? sample
          : best)
    : undefined
  const selectedMinute = Math.max(0, Math.min(hours * 60, Math.round((now.getTime() - start.getTime()) / 60_000)))
  const pick = (element: HTMLDivElement, clientX: number) => {
    const box = element.getBoundingClientRect()
    return timeAtFraction(start, hours, (clientX - box.left) / box.width)
  }
  const moveBy = (minutes: number) =>
    timeAtFraction(start, hours, (selectedMinute + minutes) / (hours * 60))

  return (
    <figure className="m-0">
      <div
        className={onSelect ? 'cursor-ew-resize touch-pan-y' : undefined}
        role={onSelect ? 'slider' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={onSelect ? 'Selected current time' : undefined}
        aria-valuemin={onSelect ? 0 : undefined}
        aria-valuemax={onSelect ? hours * 60 : undefined}
        aria-valuenow={onSelect ? selectedMinute : undefined}
        aria-valuetext={onSelect ? chartTime(now, station.timezone) : undefined}
        onPointerDown={onSelect ? (event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          onSelect(pick(event.currentTarget, event.clientX))
        } : undefined}
        onPointerMove={onSelect ? (event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            onSelect(pick(event.currentTarget, event.clientX))
          }
        } : undefined}
        onPointerUp={onSelect ? (event) => {
          const at = pick(event.currentTarget, event.clientX)
          event.currentTarget.releasePointerCapture(event.pointerId)
          onSelect(at)
          onCommit?.(at)
        } : undefined}
        onPointerCancel={onSelect ? (event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
        } : undefined}
        onKeyDown={onSelect ? (event) => {
          const at = event.key === 'Home'
            ? start
            : event.key === 'End'
              ? timeAtFraction(start, hours, 1)
              : event.key === 'ArrowLeft'
                ? moveBy(-10)
                : event.key === 'ArrowRight'
                  ? moveBy(10)
                  : undefined
          if (!at) return
          event.preventDefault()
          onSelect(at)
          onCommit?.(at)
        } : undefined}
      >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={describe(station, events, now)}
      >
        <defs>
          <linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={PAD_TOP} y2={H - PAD_BOTTOM}>
            <stop offset="0" stopColor="#38BDF8" stopOpacity="0.38" />
            <stop offset="0.5" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0.38" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          <clipPath id={areaId}><path d={area} /></clipPath>
          {/* The window has to end somewhere; a hard vertical cut reads as a
              rendering fault, so let the fill fade out instead. */}
          {/* WHITE, not black: an SVG mask is luminance-based, so black hides
              and white reveals. Black stops here erase the entire curve. */}
          <linearGradient id={fadeId} x1="0" x2="1" y1="0" y2="0">
            {fadeStops(x(actualNow ?? now) / W).map((s, i) => (
              <stop key={i} offset={s.offset} stopColor="#fff" stopOpacity={s.opacity} />
            ))}
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
            <path d={area} fill="#00101F" data-shade="night" />
            <g clipPath={`url(#${areaId})`}>
              {daylight.map(([from, to]) => (
                <rect key={from.getTime()} x={x(from)} y={0} width={x(to) - x(from)} height={H}
                  fill="#A8CAE0" fillOpacity={0.16} data-shade="daylight" />
              ))}
            </g>
            <path d={area} fill={`url(#${fillId})`} />
            <path d={path} fill="none" stroke="#38BDF8" strokeWidth={2.2} strokeLinejoin="round" />
            {/* The same curve, inked green where the slack window is. Clipped
                rather than re-fitted: the clip's edges are the interpolated
                crossings, so the green starts and stops exactly where the water
                does and not at the nearest 10-minute sample. */}
            <g clipPath={`url(#${slackId})`}>
              <path d={path} fill="none" stroke={GO} strokeWidth={4.4} strokeLinejoin="round" />
            </g>
          </g>

          {/* Set arrow nearest each peak, speed inside the lobe, as in the app. */}
          {turns.map((e) => {
            const deg = station.source === 'bundled'
              ? e.kind === 'flood' ? station.floodDirection : station.ebbDirection
              : undefined
            const toward = e.level > 0 ? 1 : -1
            const arrowY = yOf(e.level) + toward * 18
            return (
              <g key={`t${e.time.getTime()}`} data-set={e.kind}>
                {deg !== undefined && (
                  <text x={x(e.time)} y={arrowY} textAnchor="middle" fill="#E4F0E4"
                    className="text-[15px] font-semibold"
                    transform={`rotate(${deg} ${x(e.time)} ${arrowY})`}>↑</text>
                )}
                <text x={x(e.time)} y={yOf(e.level) + toward * 39} textAnchor="middle"
                  fill="#E4F0E4" className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                  style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}>
                  {Math.abs(e.level).toFixed(1)} kn
                </text>
              </g>
            )
          })}

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
                // Just above zero so the time does not sit on the run.
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

          {actualSample && !trackingNow && (
            <circle cx={x(actualSample.time)} cy={yOf(actualSample.level)} r={3.5}
              fill="#E4F0E4" data-marker="actual-now">
              <title>{`Now at ${chartTime(actualNow!, station.timezone)}`}</title>
            </circle>
          )}

          {/* The selected instant. Green belongs to the slack run, not chrome. */}
          <g>
            <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="#5888A8" strokeOpacity={0.9} strokeWidth={1.5} />
            {/* Top, not bottom: the bottom is where a max-ebb label lands, and
                on a phone the two collide. */}
            <text
              x={x(now)}
              y={12}
              textAnchor="middle"
              fill="#5888A8"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
            >
              {trackingNow ? 'Now' : chartTime(now, station.timezone)}
            </text>
          </g>
        </g>
      </svg>
      </div>

      {/* Visible, not only in the sr-only caption: these are DFO's own
          published numbers and this is the one place on the page that says so
          once the identity panel has been replaced by the chart it offered.
          The US pages credit nothing here because NOAA's data is public
          domain; DFO's is not. */}
      {station.source === 'chs' && (
        <p className="mt-3 text-sm text-sw-steel">
          Predictions {provenance(station)}, fetched from DFO by your browser.
        </p>
      )}

      <figcaption className="sr-only">{describe(station, events, now)}</figcaption>

    </figure>
  )
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
