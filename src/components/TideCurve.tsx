import { useId, useMemo } from 'react'
import { DATUM_NOTE, datumLine, provenance } from '#/lib/copy'
import { dayLabel, height, hhmm } from '#/lib/format'
import { predictSeries } from '#/lib/predict'
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

export function TideCurve(props: Props) {
  const { station, start, hours, now, width: W = 1000, height: H = 320 } = props
  // Unique per instance. The page renders this twice — a phone version and a
  // desktop one, one of them display:none — and shared element ids make the
  // second SVG reference the first's gradient, which sits in a hidden subtree
  // and paints nothing. The stroke survives, the fill silently vanishes.
  const uid = useId().replace(/:/g, '')
  const fillId = `fill-${uid}`
  const maskId = `edges-${uid}`
  const fadeId = `fade-${uid}`
  const clipId = `plot-${uid}`

  const datum = datumLine(station)

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, x, yOf, high, low } = useMemo(() => {
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

    return {
      yOf: y,
      path: `M${pts.join('L')}`,
      area: `M${x(samples[0].time).toFixed(2)},${y(min)}L${pts.join('L')}L${x(samples[samples.length - 1].time).toFixed(2)},${y(min)}Z`,
      x,
      high,
      low,
    }
    // `props` itself would be a new object every render, and this page ticks:
    // the whole path would be rebuilt once a minute for a curve that has not
    // changed. The fetched arrays are set once and never mutated.
  }, [station, props.samples, props.high, props.low, start, hours])

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={describe(station, high, low)}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3B7BC9" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3B7BC9" stopOpacity="0.05" />
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
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <g mask={`url(#${maskId})`}>
            <path d={area} fill={`url(#${fillId})`} />
            <path d={path} fill="none" stroke="#DFEEE0" strokeWidth={2.2} strokeLinejoin="round" />
          </g>

          {/* High and low — a dot and a number, no ramp, no slack. */}
          {[high, low].map((e) => (
            <g key={e.time.getTime()}>
              <circle cx={x(e.time)} cy={yOf(e.level)} r={4} fill="#E4F0E4" />
              <text
                x={x(e.time)}
                y={yOf(e.level) + (e === high ? -14 : 22)}
                textAnchor="middle"
                fill="#E4F0E4"
                className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
              >
                {height(e.level)} ft
              </text>
            </g>
          ))}

          {/* Now. Steel, not leaf: leaf and slack share one hex in the token
              set, and this component has no state to colour by. */}
          <g>
            <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="#5888A8" strokeOpacity={0.9} strokeWidth={1.5} />
            {/* Top, not bottom: the bottom is where a low label lands, and on a
                phone the two collide. */}
            <text
              x={x(now)}
              y={12}
              textAnchor="middle"
              fill="#5888A8"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
            >
              Now
            </text>
          </g>
        </g>
      </svg>

      {datum && (
        <div className="mt-3">
          <p className="text-sm text-sw-steel">{datum}</p>
          <p className="mt-1 text-sm text-sw-steel/70">{DATUM_NOTE}</p>
        </div>
      )}

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
