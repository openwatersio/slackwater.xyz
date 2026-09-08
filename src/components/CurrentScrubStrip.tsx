import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Sky } from './Sky'
import { SKY_HORIZON_OVERLAP } from '#/lib/sky'
import { skyState } from '#/lib/sky-state'
import type { SkyDays } from '#/lib/sky-state'
import { predictSeries, slackWindows } from '#/lib/predict'
import { CurrentLead } from './CurrentLead'
import type { BundledStation } from '#/lib/station'

/** SVG paint reads the tokens directly: this component never reaches resvg, and a literal would not follow the theme. */
const CURVE_INK = 'var(--color-sw-foam)'
const CENTERLINE_INK = 'var(--color-sw-foam)'
/** `CurveStyle.fillOpacity`. */
const FILL_OPACITY = 0.5

/**
 * The box the strip draws in before it has measured itself — and what the
 * prerender uses, since a server render has no layout to measure.
 */
const FALLBACK_BOX = { width: 900, height: 620 }

/**
 * The strip's own rendered size in CSS pixels.
 *
 * The app reads this from a `GeometryReader` for the same reason: the sky is a
 * projection into whatever box it has, not a fixed-aspect illustration, so
 * drawing at invented dimensions and letting CSS stretch the result puts the
 * horizon in the wrong place.
 */
function useBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState(FALLBACK_BOX)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setBox({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return box
}

/** Hours across the frame. The app is 18pt/hour, which is about this at phone width. */
const WINDOW_HOURS = 24
/** The plot's share of the frame, matching the app's 150pt of an 850pt screen. */
const PLOT_FRACTION = 0.22
const PLOT_MIN = 140
const PLOT_MAX = 220

export function CurrentScrubStrip({
  station, days, from, to, scrubTime, seconds, live,
}: {
  station: BundledStation
  days: SkyDays
  /** The sampled span. Stable across frames — the curve is computed once and panned. */
  from: Date
  to: Date
  scrubTime: Date
  seconds: number
  /** Is `scrubTime` actually now? A prerendered readout would freeze at build time and go stale. */
  live: boolean
}) {
  // Ids must be per-instance: two strips on one page would otherwise both
  // resolve to the first one's gradients, and the second would paint nothing.
  const uid = useId().replace(/:/g, '')
  const frame = useRef<HTMLDivElement>(null)
  const { width, height } = useBox(frame)
  const plot = Math.min(PLOT_MAX, Math.max(PLOT_MIN, height * PLOT_FRACTION))
  const skyHeight = height - plot + SKY_HORIZON_OVERLAP

  // The curve either side of the window, so panning never reaches an empty edge.
  const pad = (WINDOW_HOURS / 2) * 3600_000
  const { path, area, x, windows } = useMemo(() => {
    const start = new Date(from.getTime() - pad)
    const hours = (to.getTime() - from.getTime() + 2 * pad) / 3600_000
    const samples = predictSeries(station, start, hours)
    const peak = Math.max(...samples.map((s) => Math.abs(s.level))) || 1
    const perHour = width / WINDOW_HOURS
    const x = (t: Date) => ((t.getTime() - start.getTime()) / 3600_000) * perHour
    // The fill's gradient is clear at `offset 0.5`, so zero MUST land on the
    // plot's midline. Fitting the plot to the day's range would break that.
    const y = (level: number) => plot / 2 - (level / peak) * (plot / 2)
    const points = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.level).toFixed(2)}`)
    return {
      x,
      windows: slackWindows(samples),
      path: `M${points.join('L')}`,
      area: `M${x(start).toFixed(2)},${y(0)}L${points.join('L')}L${x(samples.at(-1)!.time).toFixed(2)},${y(0)}Z`,
    }
  }, [station, from, to, width, plot, pad])

  const level = levelAt(station, scrubTime)
  // Green is slack and only slack, so it follows `slackWindows` rather than the
  // bare threshold: a lull that dips under it and builds back the way it came
  // never reverses, and colouring it green would promise a transit that never opens.
  const slack = windows.some((w) => scrubTime >= w.start && scrubTime <= w.end)
  const state = slack ? 'Slack' : level > 0 ? 'Flooding' : 'Ebbing'
  const pan = `translate(${(width / 2 - x(scrubTime)).toFixed(2)} 0)`

  return (
    <div ref={frame} className="relative h-full w-full">
      <Sky state={skyState({ time: scrubTime, latitude: station.latitude, longitude: station.longitude, days })}
        width={width} height={skyHeight} seconds={seconds}
        // Percent of the frame, not the numeric `skyHeight`: server-side that
        // number is FALLBACK_BOX's, leaving a band of bare page background
        // between sky and curve in a 100dvh section before hydration measures
        // the real box.
        cssHeight={`calc(100% - ${plot - SKY_HORIZON_OVERLAP}px)`} />

      <div className="absolute inset-x-0 bottom-0" style={{ height: plot }}>
        <svg viewBox={`0 0 ${width} ${plot}`} className="h-full w-full" role="img"
          aria-label={live ? `Tidal current at ${station.name}, ${state.toLowerCase()}` : `Tidal current at ${station.name}`}>
          <defs>
            {/* The fill says only how far from slack the water is: the set carries
                direction. Clear at zero, intensifying to either extreme. */}
            <linearGradient id={`fill-${uid}`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={plot}>
              <stop offset="0" stopColor="var(--color-sw-graph-line)" stopOpacity={FILL_OPACITY} />
              <stop offset="0.5" stopColor="var(--color-sw-graph-line)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--color-sw-graph-line)" stopOpacity={FILL_OPACITY} />
            </linearGradient>
          </defs>
          <g transform={pan}>
            <path d={area} fill={`url(#fill-${uid})`} />
            <path d={path} fill="none" stroke={CURVE_INK} strokeWidth="2" />
          </g>
          <line x1={width / 2} x2={width / 2} y1={0} y2={plot} stroke={CENTERLINE_INK} strokeOpacity="0.5" />
        </svg>
      </div>

      {/* Gated on `live`: a prerendered render freezes at build time, and this
          block claims a reading "now" — stale by however long ago the site
          was built, and drifting further every day it isn't rebuilt. */}
      {live && (
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: plot + 12 }}>
          <CurrentLead
            level={level}
            setDegrees={level > 0 ? (station.floodDirection ?? 0) : (station.ebbDirection ?? 0)}
            slack={slack}
            at={scrubTime}
            timeZone={station.timezone}
          />
        </div>
      )}
    </div>
  )
}

/** The level under the centerline, to the second — the curve's own grid is ten minutes. */
function levelAt(station: BundledStation, at: Date): number {
  const [sample] = predictSeries(station, at, 1 / 3600, 1)
  return sample?.level ?? 0
}
