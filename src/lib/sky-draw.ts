import {
  MOON_GLYPH_SIZE, SKY_ALTITUDE_SCALE, SUN_DISC_RADIUS, SUN_GLOW_RADIUS,
  moonGlareOpacity, moonGlowRadius, skyPoint, starHazeOpacity, starOpacity, starTwinkle,
} from './sky'
import type { SkyState } from './sky-state'

/** The slice of `CanvasRenderingContext2D` the sky needs, so it can be recorded in a test. */
export interface SkySurface {
  /** The context's own union, not `string`: a narrower property makes a real context unassignable. */
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  save(): void
  restore(): void
  beginPath(): void
  arc(x: number, y: number, r: number, from: number, to: number): void
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, from: number, to: number, counter?: boolean): void
  translate(x: number, y: number): void
  rotate(radians: number): void
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient
  fill(): void
}

const TAU = Math.PI * 2
/**
 * The app's sky band tops out near 62 degrees (186pt at three pixels per
 * degree) and its bodies fill it. Drawing a taller band at the same scale
 * would end the star field partway up, at a hard edge exactly where the haze
 * ramp is brightest, so the same range is fitted to the height on offer.
 */
const SKY_VISIBLE_CEILING_DEG = 62
/** The moon's own inks; the sky's colours are the gradient's, not the canvas's. */
const MOON_INK = '#e6eeff'
const MOON_HALO_INK = '#cfe0ff'
const STAR_INK = '#ffffff'
const SUN_INK = '#f0c860'
/** `SkyBackdrop` blurs the sun's glow by this much before compositing it. */
const SUN_GLOW_BLUR = 12

/** Canvas takes an eight-digit hex, so the stop carries its own alpha. */
function withAlpha(hex: string, alpha: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  return hex + byte.toString(16).padStart(2, '0')
}

/**
 * A body's glow.
 *
 * The app blurs a flat disc; a canvas filter is the same operation but is not
 * dependable, and where it is missing it silently no-ops back to a hard ring —
 * the failure being fixed here. A gradient falls off deterministically instead.
 */
function glow(
  ctx: SkySurface, x: number, y: number, radius: number,
  stops: readonly (readonly [number, string])[], alpha: number,
) {
  if (alpha <= 0 || radius <= 0) return
  const paint = ctx.createRadialGradient(x, y, 0, x, y, radius)
  for (const [at, colour] of stops) paint.addColorStop(at, colour)
  ctx.globalAlpha = alpha
  ctx.fillStyle = paint
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

function disc(ctx: SkySurface, x: number, y: number, r: number, ink: string, alpha: number) {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

export function drawSky(
  ctx: SkySurface,
  state: SkyState,
  geo: { width: number; height: number; seconds: number; reduceMotion: boolean },
): void {
  const { width, height, seconds, reduceMotion } = geo
  const band = SKY_VISIBLE_CEILING_DEG * SKY_ALTITUDE_SCALE
  const stretch = height / band
  const size = { width, height: band, latitude: state.latitude }
  /** `skyPoint` places into the app's own band; the stretch fits that band to this one. */
  const place = (p: { x: number; y: number }) => ({ x: p.x, y: height - (band - p.y) * stretch })
  const altitude = state.sun?.altDeg ?? -18
  const stars = starOpacity(altitude)
  // A body is past the edge once its whole symbol is below the horizon. The
  // symbol and the altitude scale both carry `stretch`, so it cancels and the
  // floor is the app's own: a radius in points over points per degree.
  const sunFloorDeg = -SUN_DISC_RADIUS / SKY_ALTITUDE_SCALE
  const moonFloorDeg = -(MOON_GLYPH_SIZE / 2) / SKY_ALTITUDE_SCALE

  if (stars > 0) {
    for (const star of state.stars) {
      const haze = starHazeOpacity(star.altDeg)
      if (haze <= 0) continue
      const point = place(skyPoint({ azimuth: star.azDeg, altitude: star.altDeg, span: state.sunSpan, ...size }))
      const radius = Math.max(0.5, 1.6 - 0.3 * star.magnitude)
      disc(ctx, point.x, point.y, radius, STAR_INK,
        stars * haze * starTwinkle(star.index, seconds, reduceMotion))
    }
  }

  // Below the horizon a body is past an edge, so nothing is drawn for it.
  const sunPoint = state.sun && state.sun.altDeg > sunFloorDeg
    ? place(skyPoint({ azimuth: state.sun.azDeg, altitude: state.sun.altDeg, span: state.sunSpan, pad: SUN_DISC_RADIUS * stretch, ...size }))
    : undefined
  if (sunPoint) {
    // The blur spreads the disc's edge either way, so the drawn glow reaches
    // past the app's radius and holds full strength inside it.
    const reach = (SUN_GLOW_RADIUS + SUN_GLOW_BLUR) * stretch
    const plateau = (SUN_GLOW_RADIUS - SUN_GLOW_BLUR) / (SUN_GLOW_RADIUS + SUN_GLOW_BLUR)
    glow(ctx, sunPoint.x, sunPoint.y, reach, [
      [0, withAlpha(SUN_INK, 0.24)],
      [plateau, withAlpha(SUN_INK, 0.24)],
      [1, withAlpha(SUN_INK, 0)],
    ], 1)
    disc(ctx, sunPoint.x, sunPoint.y, SUN_DISC_RADIUS * stretch, SUN_INK, 1)
  }

  if (state.moon && state.illumination && state.moon.altDeg > moonFloorDeg) {
    const point = place(skyPoint({
      azimuth: state.moon.azDeg, altitude: state.moon.altDeg, span: state.moonSpan,
      pad: (MOON_GLYPH_SIZE / 2) * stretch, ...size,
    }))
    const glare = sunPoint ? Math.hypot(sunPoint.x - point.x, sunPoint.y - point.y) : Infinity
    const visible = moonGlareOpacity(glare)
    if (visible > 0) {
      const fraction = state.illumination.fraction
      const lit = 0.1 + fraction * 0.66
      glow(ctx, point.x, point.y, moonGlowRadius(fraction) * stretch, [
        [0, withAlpha(MOON_INK, 0.95 * lit)],
        [0.45, withAlpha(MOON_HALO_INK, 0.28 * lit)],
        [1, withAlpha(MOON_HALO_INK, 0)],
      ], visible)
      drawMoonGlyph(ctx, point.x, point.y, fraction, state.moonLightAngle, visible, MOON_GLYPH_SIZE * stretch)
    }
  }
  ctx.globalAlpha = 1
}

/** `rotate` aims the lit limb at the sun; without it a dawn crescent points the wrong way. */
function drawMoonGlyph(
  ctx: SkySurface, cx: number, cy: number, fraction: number, lightAngle: number, alpha: number,
  size: number,
) {
  const r = size / 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = MOON_INK
  ctx.translate(cx, cy)
  ctx.rotate(lightAngle)
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2)
  // Non-obvious: the sweep flips at exactly the quarters, where the terminator's bow reverses.
  ctx.ellipse(0, 0, r * Math.abs(1 - 2 * fraction), r, 0, Math.PI / 2, -Math.PI / 2, fraction < 0.5)
  ctx.fill()
  ctx.restore()
}
