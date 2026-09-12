import { useId, useMemo } from 'react'
import { provenance } from '#/lib/copy'
import { daylightSpans } from '#/lib/daylight'
import { fadeStops } from '#/lib/fade'
import { chartTime, dayLabel, height, hhmm } from '#/lib/format'
import { predictSeries, tideExtremes } from '#/lib/predict'
import type { Sample } from '#/lib/predict'
import type { BundledStation, ChsStation, Station } from '#/lib/station'

/**
 * The height curve, drawn the way a tide actually behaves.
 *
 * A tide has no direction, no slack and no speed to ramp — it is one line that
 * rises and falls between a high and a low. Colour is state, form is kind: a
 * current's flood/ebb/slack language does not apply here, so this is not that
 * component with different numbers, it is a smaller one.
 */

interface Common {
  start: Date
  hours: number
  now: Date
  actualNow?: Date
  /** True only while this selected instant follows the reader's clock. */
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
}

/**
 * Either a station whose curve we can compute, or a station whose curve
 * arrived from somewhere else — never a CHS station with neither.
 *
 * The same union `CurrentCurve` carries, for the same reason `Station` is one:
 * `predictSeries` narrows to `BundledStation`, so a stub reaching the
 * prediction path is a compile error rather than a throw on a prerendered
 * Canadian page. Optional props would put that failure back at runtime.
 *
 * `high` and `low` come with the samples because DFO publishes them: the
 * extremes of a fifteen-minute grid are a sampling of the numbers in the tide
 * tables, not the numbers themselves.
 */
type Props = Common &
  (
    | { station: BundledStation; samples?: never; high?: never; low?: never }
    | { station: ChsStation; samples: Sample[]; high: Sample; low: Sample }
  )

export function timeAtFraction(start: Date, hours: number, fraction: number): Date {
  const minute = Math.round(Math.max(0, Math.min(1, fraction)) * hours * 60)
  return new Date(start.getTime() + minute * 60_000)
}

export function TideCurve(props: Props) {
  const {
    station, start, hours, now, actualNow, trackingNow = false, onSelect, onCommit,
    width: W = 1000, height: H = 320,
  } = props
  // Unique per instance. The page renders this twice — a phone version and a
  // desktop one, one of them display:none — and shared element ids make the
  // second SVG reference the first's gradient, which sits in a hidden subtree
  // and paints nothing. The stroke survives, the fill silently vanishes.
  const uid = useId().replace(/:/g, '')
  const fillId = `fill-${uid}`
  const maskId = `edges-${uid}`
  const fadeId = `fade-${uid}`
  const clipId = `plot-${uid}`
  const areaId = `area-${uid}`

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, x, yOf, high, low, extremes, samples } = useMemo(() => {
    const samples = props.samples ?? predictSeries(props.station, start, hours)
    const levels = samples.map((s) => s.level)
    const max = Math.max(...levels)
    const min = Math.min(...levels)
    const range = max - min || 1

    const span = hours * 3600_000
    const x = (t: Date) => ((t.getTime() - start.getTime()) / span) * W
    const plot = H - PAD_TOP - PAD_BOTTOM
    const y = (level: number) => PAD_TOP + plot - ((level - min) / range) * plot

    const pts = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.level).toFixed(2)}`)

    // A fetched curve brings DFO's own published high and low; a computed one
    // has no published anything, so its extremes are the curve's own.
    const high = props.high ?? samples.reduce((best, s) => (s.level > best.level ? s : best))
    const low = props.low ?? samples.reduce((best, s) => (s.level < best.level ? s : best))
    // Every turn in the window, not just the day's highest and lowest: a
    // semidiurnal day has two of each, and a reader planning the afternoon
    // needs the afternoon's. DFO publishes one pair per fetch, so a Canadian
    // curve labels that pair.
    const extremes = props.samples
      ? [{ time: high.time, level: high.level, high: true }, { time: low.time, level: low.level, high: false }]
      : tideExtremes(props.station, start, hours)

    return {
      yOf: y,
      path: `M${pts.join('L')}`,
      area: `M${x(samples[0].time).toFixed(2)},${y(min)}L${pts.join('L')}L${x(samples[samples.length - 1].time).toFixed(2)},${y(min)}Z`,
      x,
      high,
      low,
      extremes,
      samples,
    }
    // `props` itself would be a new object every render, and this page ticks:
    // the whole path would be rebuilt once a minute for a curve that has not
    // changed. The fetched arrays are set once and never mutated.
  }, [station, props.samples, props.high, props.low, start, hours])

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
        aria-label={onSelect ? 'Selected tide time' : undefined}
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
        className="tide-curve w-full"
        role="img"
        aria-label={describe(station, high, low)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#38BDF8" stopOpacity="0.38" />
            <stop offset="1" stopColor="#38BDF8" stopOpacity="0.04" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
          <clipPath id={areaId}>
            <path d={area} />
          </clipPath>
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
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <g mask={`url(#${maskId})`}>
            <path d={area} fill="#00101F" data-shade="night" />
            <g clipPath={`url(#${areaId})`}>
              {daylight.map(([from, to]) => (
                <rect
                  key={from.getTime()}
                  x={x(from)}
                  y={0}
                  width={x(to) - x(from)}
                  height={H}
                  fill="#A8CAE0"
                  fillOpacity={0.16}
                  data-shade="daylight"
                />
              ))}
            </g>
            <path d={area} fill={`url(#${fillId})`} />
            <path d={path} fill="none" stroke="none" strokeWidth={5} strokeLinejoin="round" data-curve-edge="" />
            <path d={path} fill="none" stroke="#38BDF8" strokeWidth={2.2} strokeLinejoin="round" />
          </g>

          {/* Highs and lows — a dot and a number, no ramp, no slack. */}
          {extremes.map((e) => (
            <g key={e.time.getTime()} data-turn={e.high ? 'high' : 'low'}>
              <circle cx={x(e.time)} cy={yOf(e.level)} r={4.5} fill={e.high ? '#2DD4BF' : '#FBBF24'} />
              <text
                x={x(e.time)}
                y={yOf(e.level) + (e.high ? -14 : 22)}
                textAnchor="middle"
                fill={e.high ? '#2DD4BF' : '#FBBF24'}
                className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                stroke="#00121F"
                strokeWidth={3}
                style={{ paintOrder: 'stroke' }}
              >
                {height(e.level)} ft
              </text>
              <text
                x={x(e.time)}
                y={yOf(e.level) + (e.high ? 18 : 38)}
                textAnchor="middle"
                fill={e.high ? '#2DD4BF' : '#FBBF24'}
                className="font-mono text-[11px] font-medium [font-variant-numeric:tabular-nums]"
                stroke="#00121F"
                strokeWidth={3}
                style={{ paintOrder: 'stroke' }}
              >
                {chartTime(e.time, station.timezone)}
              </text>
            </g>
          ))}

          {actualSample && !trackingNow && (
            <circle
              cx={x(actualSample.time)}
              cy={yOf(actualSample.level)}
              r={3.5}
              fill="#E4F0E4"
              data-marker="actual-now"
            >
              <title>{`Now at ${chartTime(actualNow!, station.timezone)}`}</title>
            </circle>
          )}

          {/* The selected instant. Steel, not leaf: green belongs to slack. */}
          <g data-selected-time="">
            <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="#5888A8" strokeOpacity={0.9} strokeWidth={1.5} />
            {/* Top, not bottom: the bottom is where a low label lands, and on a
                phone the two collide. */}
            <text
              x={x(now)}
              y={12}
              textAnchor="middle"
              fill="#5888A8"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
              stroke="#00121F"
              strokeWidth={3}
              style={{ paintOrder: 'stroke' }}
            >
              {trackingNow ? 'Now' : chartTime(now, station.timezone)}
            </text>
          </g>
        </g>
        </svg>
      </div>

      <figcaption className="sr-only">{describe(station, high, low)}</figcaption>
    </figure>
  )
}

/**
 * Spoken form, for anyone who can't see the curve. Units written in full, and
 * each time carries its own day: the window straddles midnight, so a bare
 * `hh:mm` leaves a reader unable to tell which day the low belongs to.
 *
 * "Computed from harmonic constituents", not "computed on this device": this
 * same sentence ships in prerendered HTML, where no device computed anything.
 * The claim has to be true on both rendering paths.
 */
function describe(station: Station, high: { time: Date; level: number }, low: { time: Date; level: number }) {
  const tz = station.timezone
  return (
    `Tide predictions for ${station.name}, ${provenance(station)}. ` +
    `High ${height(high.level)} feet on ${dayLabel(high.time, tz)} at ${hhmm(high.time, tz)}, ` +
    `low ${height(low.level)} feet on ${dayLabel(low.time, tz)} at ${hhmm(low.time, tz)}` +
    // The datum belongs in the spoken form for the same reason it is on the
    // page: a height quoted against nothing cannot be acted on. A CHS port
    // names no code — see `datumLine` — so it says the thing itself.
    (station.source === 'chs'
      ? ', above chart datum.'
      : station.chartDatum
        ? `, above ${station.chartDatum}, the chart datum.`
        : '.')
  )
}
