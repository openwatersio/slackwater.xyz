import { useId } from 'react'
import { chartTime } from '#/lib/format'
import type { Comparison } from '#/lib/slack-guide'

/**
 * The tide at a gauge stacked over the current in the pass beside it, on one
 * time axis, so a reader can drop a line from each slack and see that it does
 * not land on a high or a low.
 *
 * Everything drawn arrives precomputed in `day`; this only lays it out. The
 * vertical rules carry the argument: steel for the gauge's highs and lows,
 * green for the pass's slacks, and the gap between the called-out pair
 * measured on the chart itself.
 */
/**
 * A label on a canvas-coloured plate, so the rules it sits on stop at its
 * edge instead of striking through it. A stroke halo clears only the glyphs
 * and leaves the rules showing between letters. The width is estimated from
 * the character count — an SVG has no layout to measure against before it
 * renders, and a plate a few pixels wide of the text costs nothing.
 */
function Label({
  x, y, anchor = 'start', size, className, text,
}: {
  x: number
  y: number
  anchor?: 'start' | 'middle' | 'end'
  size: number
  className: string
  text: string
}) {
  const w = text.length * size * 0.56 + 8
  const left = anchor === 'start' ? x - 4 : anchor === 'middle' ? x - w / 2 : x - w + 4
  return (
    <g>
      <rect x={left} y={y - size} width={w} height={size * 1.35} rx={3} className="fill-sw-canvas" />
      <text x={x} y={y} textAnchor={anchor} className={className} style={{ fontSize: size }}>
        {text}
      </text>
    </g>
  )
}

export function SlackTideChart({
  comparison,
  slackKnots,
  width: W = 900,
}: {
  comparison: Comparison
  slackKnots: number
  /** viewBox width; narrowed on phones so the type stays readable. */
  width?: number
}) {
  const uid = useId().replace(/:/g, '')
  const { day, timezone: tz } = comparison
  const H = 470
  const LEFT = 8
  const RIGHT = W - 8
  // Bands, top to bottom: tide title, high labels, tide, low labels, the
  // gap callout, current title, current, time axis. Each label has a row of
  // its own so none can land on another at phone width.
  const TIDE = { top: 64, bottom: 160 }
  const CURRENT = { top: 262, bottom: 414 }
  const AXIS = 446

  const x = (t: number) => LEFT + ((t - day.start) / (day.end - day.start)) * (RIGHT - LEFT)
  const clampX = (t: number) => Math.min(RIGHT, Math.max(LEFT, x(t)))

  const heights = day.tide.map(([, h]) => h)
  const lo = Math.min(...heights)
  const hi = Math.max(...heights)
  const yTide = (h: number) => TIDE.bottom - ((h - lo) / (hi - lo || 1)) * (TIDE.bottom - TIDE.top)

  const peak = Math.max(...day.current.map(([, k]) => Math.abs(k)), slackKnots * 2)
  const mid = (CURRENT.top + CURRENT.bottom) / 2
  const yCur = (k: number) => mid - (k / peak) * ((CURRENT.bottom - CURRENT.top) / 2)

  const line = (pts: [number, number][], y: (v: number) => number) =>
    `M${pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join('L')}`
  const tidePath = line(day.tide, yTide)
  const currentPath = line(day.current, yCur)
  const area = `${currentPath}L${x(day.current.at(-1)![0]).toFixed(1)},${mid}L${x(day.current[0][0]).toFixed(1)},${mid}Z`

  const { callout } = day
  const gap = Math.round(Math.abs(callout.extreme - callout.slack) / 60_000)
  const gapText = gap >= 60 ? `${Math.floor(gap / 60)} h ${gap % 60} min` : `${gap} min`
  const bracketY = TIDE.bottom + 58
  const bx1 = clampX(Math.min(callout.slack, callout.extreme))
  const bx2 = clampX(Math.max(callout.slack, callout.extreme))

  const ticks = [6, 12, 18].map((h) => day.start + (h / 24) * (day.end - day.start))
  const floodId = `flood-${uid}`
  const ebbId = `ebb-${uid}`
  const slackClip = `slack-${uid}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby={`${uid}-title`}
      className="w-full"
    >
      <title id={`${uid}-title`}>
        {`The tide at ${comparison.tide.name} above the current in ${comparison.current.name}. ` +
          `Slack at ${chartTime(new Date(callout.slack), tz)} comes ${gapText} ` +
          `${callout.slack < callout.extreme ? 'before' : 'after'} ${callout.high ? 'high' : 'low'} water ` +
          `at ${chartTime(new Date(callout.extreme), tz)}.`}
      </title>
      <defs>
        <clipPath id={floodId}>
          <rect x={0} y={0} width={W} height={mid} />
        </clipPath>
        <clipPath id={ebbId}>
          <rect x={0} y={mid} width={W} height={H - mid} />
        </clipPath>
        <clipPath id={slackClip}>
          {day.windows.map((w) => (
            <rect key={w.start} x={clampX(w.start)} y={0} width={clampX(w.end) - clampX(w.start)} height={H} />
          ))}
        </clipPath>
      </defs>


      {/* The gauge's highs and lows, dropped through both panels. */}
      {day.extremes.map((e) => (
        <g key={e.time} className="text-sw-steel">
          <line
            x1={x(e.time)}
            x2={x(e.time)}
            y1={yTide(e.level)}
            y2={CURRENT.bottom}
            stroke="currentColor"
            strokeDasharray="3 5"
            strokeWidth={1.5}
          />
          <circle cx={x(e.time)} cy={yTide(e.level)} r={4} fill="currentColor" />
        </g>
      ))}

      <path d={tidePath} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-sw-foam" />

      <path d={area} fill="currentColor" clipPath={`url(#${floodId})`} className="text-sw-flood/30" />
      <path d={area} fill="currentColor" clipPath={`url(#${ebbId})`} className="text-sw-ebb/30" />
      <line x1={LEFT} x2={RIGHT} y1={mid} y2={mid} stroke="currentColor" className="text-sw-steel/50" />
      {/* The edges of the band the site calls slack. Lines rather than a
          fill: a tint under the flood and ebb fills muddies both. */}
      {[slackKnots, -slackKnots].map((k) => (
        <line
          key={k}
          x1={LEFT}
          x2={RIGHT}
          y1={yCur(k)}
          y2={yCur(k)}
          stroke="currentColor"
          strokeDasharray="2 4"
          className="text-sw-go/60"
        />
      ))}
      <path d={currentPath} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-sw-foam" />
      {/* The same curve, inked green where it runs inside the band. */}
      <path
        d={currentPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        clipPath={`url(#${slackClip})`}
        className="text-sw-go"
      />
      <text x={RIGHT} y={yCur(peak * 0.75)} textAnchor="end" className="fill-sw-flood text-[14px]">
        Flood
      </text>
      <text x={RIGHT} y={yCur(-peak * 0.75) + 10} textAnchor="end" className="fill-sw-ebb text-[14px]">
        Ebb
      </text>

      {/* Each slack, carried up to the tide so the gap reads directly. */}
      {day.slacks.map((t) => (
        <g key={t} className="text-sw-go">
          <line x1={x(t)} x2={x(t)} y1={yTide(lo) - 6} y2={mid} stroke="currentColor" strokeWidth={1.5} />
          <circle cx={x(t)} cy={mid} r={5} fill="currentColor" />
        </g>
      ))}

      {/* Every label after every rule, so its plate covers the rules beneath it. */}
      {day.extremes.map((e) => (
        <Label
          key={e.time}
          x={x(e.time)}
          y={e.high ? yTide(e.level) - 10 : yTide(e.level) + 22}
          anchor={x(e.time) < 60 ? 'start' : x(e.time) > W - 60 ? 'end' : 'middle'}
          size={14}
          className="fill-sw-foam"
          text={`${e.high ? 'High' : 'Low'} ${chartTime(new Date(e.time), tz)}`}
        />
      ))}
      <Label x={LEFT} y={20} size={15} className="fill-sw-steel" text={`Tide at ${comparison.tide.name}`} />
      <Label x={LEFT} y={CURRENT.top - 14} size={15} className="fill-sw-steel" text={`Current in ${comparison.current.name}`} />

      {bx2 - bx1 > 4 && (
        <g className="text-sw-go">
          <line x1={bx1} x2={bx2} y1={bracketY} y2={bracketY} stroke="currentColor" strokeWidth={2} />
          <line x1={bx1} x2={bx1} y1={bracketY - 6} y2={bracketY + 6} stroke="currentColor" strokeWidth={2} />
          <line x1={bx2} x2={bx2} y1={bracketY - 6} y2={bracketY + 6} stroke="currentColor" strokeWidth={2} />
          <Label
            x={(bx1 + bx2) / 2}
            y={bracketY - 10}
            anchor="middle"
            size={15}
            className="fill-sw-paper font-semibold"
            text={gapText}
          />
        </g>
      )}

      {ticks.map((t) => (
        <text key={t} x={x(t)} y={AXIS} textAnchor="middle" className="fill-sw-steel text-[14px]">
          {chartTime(new Date(t), tz)}
        </text>
      ))}
    </svg>
  )
}
