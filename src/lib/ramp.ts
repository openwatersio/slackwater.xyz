/**
 * The current speed ramp, lifted from the app (SN.speedRampStops, Theme.swift).
 *
 * Anchored to CAPABILITY, not to quantiles: 0.5 kn is the slack threshold, 3 kn
 * is where a paddler can no longer make way, 6 kn is where a small displacement
 * craft can't stem it, 16 kn is Sechelt Rapids. That is why the colour means
 * something rather than merely ranking the day against itself.
 *
 * Deliberately not a rainbow: a rainbow passes through green, and green means
 * slack. Its greyscale isn't monotonic either.
 */
export const RAMP = ['#0D2033', '#3B2C63', '#7B2E62', '#B8434F', '#E8763C', '#F5C96B'] as const

const KNOT_ANCHORS = [0.5, 3, 6, 16]

/** Speed in knots → 0…1 along the ramp, piecewise across the anchors. */
export function rampT(knots: number): number {
  const k = Math.abs(knots)
  const [a, b, c, d] = KNOT_ANCHORS
  if (k <= a) return 0
  if (k <= b) return ((k - a) / (b - a)) * (1 / 3)
  if (k <= c) return 1 / 3 + ((k - b) / (c - b)) * (1 / 3)
  if (k <= d) return 2 / 3 + ((k - c) / (d - c)) * (1 / 3)
  return 1
}

/**
 * Ink over the ramp, chosen by luminance rather than by taste: the ramp gets
 * light enough at the top that dark ink is the readable choice. Crossover at
 * t ≈ 0.68, same as the app's SN.speedInk.
 */
export function speedInk(knots: number): string {
  return rampT(knots) > 0.68 ? '#00121F' : '#FCFCFC'
}

/** Interpolate the ramp at t (0…1) and return a hex colour. */
export function rampColorAt(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(scaled))
  const f = scaled - i
  const a = hexToRgb(RAMP[i])
  const b = hexToRgb(RAMP[i + 1])
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** The colour for a given speed — this is the one callers should reach for. */
export const rampColor = (knots: number): string => rampColorAt(rampT(knots))

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
