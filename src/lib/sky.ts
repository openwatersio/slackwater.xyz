/**
 * The sky's paint, ramps and projection, ported from the app's `Theme.swift`,
 * which is the single source of truth. If a value here disagrees with that
 * file, that file wins.
 *
 * The anchors are the altitudes Almanac uses for its twilight events (0°, −6°,
 * −12°, −18°), so the gradient can never disagree with the twilight times.
 */

export interface SkyPaint {
  top: string
  bottom: string
}

/** Descending by altitude; `skyPaint` interpolates between neighbours. */
const ANCHORS: readonly { readonly altitude: number; readonly top: string; readonly bottom: string }[] = [
  { altitude: 10, top: '#2f7fd4', bottom: '#bde3fb' },
  { altitude: 0, top: '#2b4a7a', bottom: '#f8a15f' },
  { altitude: -6, top: '#17264a', bottom: '#8d4a63' },
  { altitude: -12, top: '#0b1430', bottom: '#2a2a52' },
  { altitude: -18, top: '#04060f', bottom: '#0b1023' },
] as const

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function skyPaint(sunAltitude: number): SkyPaint {
  const first = ANCHORS[0]
  if (sunAltitude >= first.altitude) return { top: first.top, bottom: first.bottom }
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const high = ANCHORS[i]
    const low = ANCHORS[i + 1]
    if (sunAltitude <= low.altitude) continue
    const t = (high.altitude - sunAltitude) / (high.altitude - low.altitude)
    return { top: mixHex(high.top, low.top, t), bottom: mixHex(high.bottom, low.bottom, t) }
  }
  const last = ANCHORS[ANCHORS.length - 1]
  return { top: last.top, bottom: last.bottom }
}

/** Symbols, many times the bodies' true half-degree. */
export const SUN_DISC_RADIUS = 8
export const SUN_GLOW_RADIUS = 27
export const MOON_GLYPH_SIZE = 22
/** Pixels per degree of altitude. Fixed, so a winter noon sits under a summer one. */
export const SKY_ALTITUDE_SCALE = 3
/** How far the horizon sits inside the plot, so a peak never covers a rising sun. */
export const SKY_HORIZON_OVERLAP = 16

export function moonGlowRadius(fraction: number): number {
  return 12 + fraction * 20
}

/**
 * The bodies are symbols many times their true size, so near every new moon the
 * two would otherwise overlap like an eclipse. `distance` is between their
 * projected centres.
 */
export function moonGlareOpacity(distance: number): number {
  const touching = SUN_DISC_RADIUS + MOON_GLYPH_SIZE / 2
  const clear = SUN_GLOW_RADIUS + MOON_GLYPH_SIZE / 2
  return clamp((distance - touching) / (clear - touching), 0, 1)
}

export function starOpacity(sunAltitude: number): number {
  return clamp(((-sunAltitude - 6) / 12) * 0.7, 0, 0.7)
}

export function starTwinkle(index: number, seconds: number, reduceMotion: boolean): number {
  if (reduceMotion) return 1
  return 0.86 + 0.14 * Math.sin(seconds * (0.55 + (index % 5) * 0.08) + index * 1.7)
}

export function skyOpacity(sunAltitude: number): number {
  return 1 - clamp((sunAltitude + 6) / 6, 0, 1) * 0.45
}

/** Stars brighten from the horizon up into the zenith's clear air. */
export function starHazeOpacity(altitude: number): number {
  return clamp((altitude + 10) / 50, 0, 1)
}

/**
 * Where a body crosses the horizon: the azimuths at its last rise at or before
 * a moment and its first set at or after it.
 */
export interface HorizonSpan {
  riseAz: number
  setAz: number
}

/**
 * The sky as a window whose side edges are the horizon. A body's own
 * rise-to-set azimuths stretch across the width, so it rises at the RIGHT edge
 * and sets at the left: the horizon is a circle, and a rectangle's edges can
 * only be it by fitting each body's arc to the frame. Mirrored from a sky chart
 * — east on the right, in either hemisphere — because the frame is the
 * timeline, not a compass, so a body sweeps with the curve it drives.
 *
 * `pad` is the body's disc radius: at the horizon the disc has just cleared the
 * edge. With no span the window is the whole 360°.
 */
export function skyPoint({
  azimuth, altitude, latitude, span, pad = 0, width, height,
}: {
  azimuth: number
  altitude: number
  latitude: number
  span?: HorizonSpan
  pad?: number
  width: number
  height: number
}): { x: number; y: number } {
  const center = latitude >= 0 ? 180 : 0
  // Degrees from the meridian, negative toward the rising side.
  const signed = (az: number) => {
    const s = ((az - center + 540) % 360) - 180
    return latitude >= 0 ? s : -s
  }
  let rise = -180
  let set = 180
  if (span && signed(span.riseAz) < signed(span.setAz)) {
    rise = signed(span.riseAz)
    set = signed(span.setAz)
  }
  const perDegree = (width + 2 * pad) / (set - rise)
  return {
    x: width + pad - (signed(azimuth) - rise) * perDegree,
    y: height - altitude * SKY_ALTITUDE_SCALE,
  }
}
