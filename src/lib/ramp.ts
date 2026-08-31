/**
 * The speed magnitude ramp, ported from the app's `SN.speedRampStops`
 * (Theme.swift), which is the single source of truth.
 *
 * Yellow at the comfort threshold, orange beyond it, red at the fast end. It
 * deliberately never enters green: green is reserved for a usable slack window.
 *
 * What this replaces claimed the same provenance and did not have it — a
 * six-stop inferno running dark navy through purple and magenta to yellow.
 * That is the opposite end of the scale at both ends (darkest where the app is
 * yellowest, brightest where the app is red) and three of its stops are
 * colours the app has no name for.
 */
export const SPEED_STOPS: readonly (readonly [number, string])[] = [
  [0, '#F5C96B'],
  [1 / 3, '#F5C96B'],
  [2 / 3, '#E8763C'],
  [1, '#C93A32'],
] as const

/**
 * The ramp sampled at `t`, clamped to 0…1. Piecewise-linear in sRGB: the stops
 * sit close enough together that a perceptual space buys nothing a reader
 * could see. (`SN.speedRGB`.)
 *
 * `t` is a position in the plot, not a speed. The app's strip runs this
 * gradient from the threshold line to the edge of the auto-fitted plot, so the
 * day's peak is always the red end whatever it measures — see the fill in
 * CurrentCurve. The absolute knots→t scale (`widgetSpeedRampT`) is the map's,
 * and the web has no map.
 */
export function speedColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  for (let i = 0; i < SPEED_STOPS.length - 1; i++) {
    const [at, ahex] = SPEED_STOPS[i]
    const [bt, bhex] = SPEED_STOPS[i + 1]
    if (clamped < at || clamped > bt) continue
    const f = bt === at ? 0 : (clamped - at) / (bt - at)
    const a = hexToRgb(ahex)
    const b = hexToRgb(bhex)
    const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f))
    return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
  }
  return SPEED_STOPS[SPEED_STOPS.length - 1][1].toLowerCase()
}

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
