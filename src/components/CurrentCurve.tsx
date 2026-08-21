import { useId, useMemo } from 'react'
import { rampColor, speedInk } from '#/lib/ramp'
import { findEvents, nextEvent, predictSeries, type CurrentEvent } from '#/lib/currents'

/**
 * The signed velocity curve, drawn the way the app draws it.
 *
 * Colour is state, form is kind. The fill is the speed ramp — one horizontal
 * gradient across the whole curve, so colour reads as "how hard is it running"
 * and never as "what kind of station is this". Green appears exactly once, as
 * the slack window, and it is drawn UNDER the fill: slack is ground, not figure.
 */

interface Props {
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
}

export function CurrentCurve({
  start,
  hours,
  now,
  width: W = 1000,
  height: H = 320,
  sparse = false,
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

  const PAD_TOP = 34
  const PAD_BOTTOM = 44
  const { path, area, zeroY, x, yOf, events, stops } = useMemo(() => {
    const samples = predictSeries(start, hours)
    const events = findEvents(start, hours)
    const peak = Math.max(...samples.map((s) => Math.abs(s.knots)), 1)

    const span = hours * 3600_000
    const x = (t: Date) => ((t.getTime() - start.getTime()) / span) * W
    const plot = H - PAD_TOP - PAD_BOTTOM
    const y = (k: number) => PAD_TOP + plot / 2 - (k / peak) * (plot / 2)

    const pts = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.knots).toFixed(2)}`)

    // Gradient stops run along time, but each stop's COLOUR comes from that
    // moment's speed. A left-to-right ramp would colour by clock position,
    // which means nothing; this way the fill is dark at slack and bright in
    // the rip, and the same colour means the same knots on any day.
    const stops = samples.map((s) => ({
      offset: x(s.time) / W,
      color: rampColor(s.knots),
    }))

    return {
      stops,
      yOf: y,
      path: `M${pts.join('L')}`,
      area: `M${x(samples[0].time).toFixed(2)},${y(0)}L${pts.join('L')}L${x(samples[samples.length - 1].time).toFixed(2)},${y(0)}Z`,
      zeroY: y(0),
      x,
      events,
    }
  }, [start, hours])

  const next = nextEvent(events, now)
  // The fill fades out over the outer 6% at each end, so a label landing there
  // annotates a curve the reader can barely see and looks clipped. Drop it —
  // the window edge is arbitrary anyway.
  const inFrame = (e: CurrentEvent) => x(e.time) > W * 0.07 && x(e.time) < W * 0.93
  const slacks = events.filter((e) => e.kind === 'slack' && inFrame(e))
  const turns = events.filter((e) => e.kind !== 'slack' && inFrame(e))

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={describe(events, now)}
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
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* Slack windows: ground, not figure. Under everything. */}
          {slacks.map((s) => (
            <rect
              key={`w${s.time.getTime()}`}
              x={x(s.time) - 9}
              y={0}
              width={18}
              height={H}
              fill="#88B868"
              opacity={0.2}
            />
          ))}

          <g mask={`url(#${maskId})`}>
            <path d={area} fill={`url(#${rampId})`} opacity={0.9} />
            <path d={path} fill="none" stroke="#DFEEE0" strokeWidth={2.2} strokeLinejoin="round" />
          </g>
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#FFFFFF" strokeOpacity={0.4} />

          {/* Max flood / max ebb — a dot and a number, ink picked by luminance. */}
          {turns.map((e) => (
            <g key={`t${e.time.getTime()}`}>
              <circle cx={x(e.time)} cy={yOf(e.knots)} r={4} fill="#E4F0E4" />
              <text
                x={x(e.time)}
                y={yOf(e.knots) + (e.knots > 0 ? -14 : 22)}
                textAnchor="middle"
                fill={speedInk(e.knots)}
                className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
              >
                {Math.abs(e.knots).toFixed(1)} kn
              </text>
            </g>
          ))}

          {/* Slack instants: foam, never green. A mathematical point is not
              something you can transit at — the window above is. */}
          {slacks.map((s) => (
            <g key={`s${s.time.getTime()}`}>
              <circle cx={x(s.time)} cy={zeroY} r={4} fill="#E4F0E4" />
              {!sparse && (
              <text
                x={x(s.time)}
                y={zeroY - 14}
                textAnchor="middle"
                fill="#E4F0E4"
                className="font-mono text-[15px] font-semibold [font-variant-numeric:tabular-nums]"
                style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
              >
                {hhmm(s.time)}
              </text>
              )}
            </g>
          ))}

          {/* Now. */}
          <g>
            <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="#88B868" strokeOpacity={0.9} strokeWidth={1.5} />
            <circle cx={x(now)} cy={zeroY} r={3} fill="#88B868" />
            {/* Top, not bottom: the bottom is where a max-ebb label lands, and
                on a phone the two collide. */}
            <text
              x={x(now)}
              y={12}
              textAnchor="middle"
              fill="#88B868"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{ paintOrder: 'stroke', stroke: '#00121F', strokeWidth: 3 }}
            >
              Now
            </text>
          </g>
        </g>
      </svg>

      <figcaption className="sr-only">{describe(events, now)}</figcaption>

      {next && (
        <p className="mt-6 text-lg">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-sw-leaf">
            Next {next.kind === 'slack' ? 'slack' : `max ${next.kind}`}
          </span>
          <br />
          <span className="[font-variant-numeric:tabular-nums] text-sw-paper">
            {hhmm(next.time)}
          </span>
          <span className="text-sw-steel"> · in {until(next.time, now)}</span>
        </p>
      )}
    </figure>
  )
}

const hhmm = (d: Date) =>
  d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false })

function until(then: Date, now: Date) {
  const mins = Math.max(0, Math.round((then.getTime() - now.getTime()) / 60_000))
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

/** Spoken form, for anyone who can't see the curve. Units written in full. */
function describe(events: CurrentEvent[], now: Date) {
  const n = nextEvent(events, now)
  if (!n) return 'Tidal current predictions for Deception Pass Narrows.'
  const what =
    n.kind === 'slack'
      ? 'slack water'
      : `maximum ${n.kind} of ${Math.abs(n.knots).toFixed(1)} knots`
  return `Tidal current at Deception Pass Narrows. Next ${what} at ${hhmm(n.time)}, computed on this device.`
}
