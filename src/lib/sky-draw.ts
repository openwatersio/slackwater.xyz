import {
  MOON_GLYPH_SIZE, SUN_DISC_RADIUS, SUN_GLOW_RADIUS,
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
  fill(): void
}

const TAU = Math.PI * 2
/** The moon's own ink; the sky's colours are the gradient's, not the canvas's. */
const MOON_INK = '#e6eeff'
const STAR_INK = '#ffffff'
const SUN_INK = '#f0c860'

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
  const size = { width, height, latitude: state.latitude }
  const altitude = state.sun?.altDeg ?? -18
  const stars = starOpacity(altitude)

  if (stars > 0) {
    for (const star of state.stars) {
      const haze = starHazeOpacity(star.altDeg)
      if (haze <= 0) continue
      const point = skyPoint({ azimuth: star.azDeg, altitude: star.altDeg, span: state.sunSpan, ...size })
      const radius = Math.max(0.5, 1.6 - 0.3 * star.magnitude)
      disc(ctx, point.x, point.y, radius, STAR_INK,
        stars * haze * starTwinkle(star.index, seconds, reduceMotion))
    }
  }

  // Below the horizon a body is past an edge, so nothing is drawn for it.
  const sunPoint = state.sun && state.sun.altDeg > -SUN_DISC_RADIUS / 3
    ? skyPoint({ azimuth: state.sun.azDeg, altitude: state.sun.altDeg, span: state.sunSpan, pad: SUN_DISC_RADIUS, ...size })
    : undefined
  if (sunPoint) {
    disc(ctx, sunPoint.x, sunPoint.y, SUN_GLOW_RADIUS, SUN_INK, 0.24)
    disc(ctx, sunPoint.x, sunPoint.y, SUN_DISC_RADIUS, SUN_INK, 1)
  }

  if (state.moon && state.illumination && state.moon.altDeg > -MOON_GLYPH_SIZE / 6) {
    const point = skyPoint({
      azimuth: state.moon.azDeg, altitude: state.moon.altDeg, span: state.moonSpan,
      pad: MOON_GLYPH_SIZE / 2, ...size,
    })
    const glare = sunPoint ? Math.hypot(sunPoint.x - point.x, sunPoint.y - point.y) : Infinity
    const visible = moonGlareOpacity(glare)
    if (visible > 0) {
      const fraction = state.illumination.fraction
      disc(ctx, point.x, point.y, moonGlowRadius(fraction), MOON_INK,
        visible * 0.28 * (0.1 + fraction * 0.66))
      drawMoonGlyph(ctx, point.x, point.y, fraction, state.moonLightAngle, visible)
    }
  }
  ctx.globalAlpha = 1
}

/**
 * The lit region as a disc masked by the terminator. The terminator is a
 * half-ellipse on the limb's own axis whose width is `r · |1 − 2·fraction|`,
 * and `rotate` aims the lit limb at the sun.
 */
function drawMoonGlyph(
  ctx: SkySurface, cx: number, cy: number, fraction: number, lightAngle: number, alpha: number,
) {
  const r = MOON_GLYPH_SIZE / 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = MOON_INK
  ctx.translate(cx, cy)
  ctx.rotate(lightAngle)
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2)
  // Bows toward the lit limb below half phase and away from it above, so the
  // sweep flips at exactly the quarters.
  ctx.ellipse(0, 0, r * Math.abs(1 - 2 * fraction), r, 0, Math.PI / 2, -Math.PI / 2, fraction < 0.5)
  ctx.fill()
  ctx.restore()
}
