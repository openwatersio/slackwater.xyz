import { describe, expect, it } from 'vitest'
import {
  MOON_GLYPH_SIZE, SKY_ALTITUDE_SCALE, SUN_DISC_RADIUS, SUN_GLOW_RADIUS,
  moonGlareOpacity, moonGlowRadius, skyOpacity, skyPaint, skyPoint,
  starHazeOpacity, starOpacity, starTwinkle,
} from './sky'

describe('skyPaint', () => {
  it('sits on the anchors Almanac uses for its twilight events', () => {
    expect(skyPaint(10)).toEqual({ top: '#2f7fd4', bottom: '#bde3fb' })
    expect(skyPaint(0)).toEqual({ top: '#2b4a7a', bottom: '#f8a15f' })
    expect(skyPaint(-6)).toEqual({ top: '#17264a', bottom: '#8d4a63' })
    expect(skyPaint(-12)).toEqual({ top: '#0b1430', bottom: '#2a2a52' })
    expect(skyPaint(-18)).toEqual({ top: '#04060f', bottom: '#0b1023' })
  })

  it('holds the ends past the outermost anchors', () => {
    expect(skyPaint(80)).toEqual(skyPaint(10))
    expect(skyPaint(-40)).toEqual(skyPaint(-18))
  })

  it('interpolates halfway between two anchors', () => {
    expect(skyPaint(-3)).toEqual({ top: '#213862', bottom: '#c37661' })
  })
})

describe('the opacity ramps', () => {
  it('caps stars at 0.7 and clears them by civil twilight', () => {
    expect(starOpacity(-18)).toBeCloseTo(0.7)
    expect(starOpacity(-40)).toBeCloseTo(0.7)
    expect(starOpacity(-12)).toBeCloseTo(0.35)
    expect(starOpacity(-6)).toBe(0)
    expect(starOpacity(10)).toBe(0)
  })

  it('mutes the daylight gradient but never the night one', () => {
    expect(skyOpacity(0)).toBeCloseTo(0.55)
    expect(skyOpacity(20)).toBeCloseTo(0.55)
    expect(skyOpacity(-6)).toBe(1)
    expect(skyOpacity(-3)).toBeCloseTo(0.775)
  })

  it('hazes stars out at the horizon and runs them below it', () => {
    expect(starHazeOpacity(-10)).toBe(0)
    expect(starHazeOpacity(-20)).toBe(0)
    expect(starHazeOpacity(0)).toBeCloseTo(0.2)
    expect(starHazeOpacity(40)).toBe(1)
    expect(starHazeOpacity(90)).toBe(1)
  })

  it('does not twinkle under reduced motion', () => {
    expect(starTwinkle(3, 12.5, true)).toBe(1)
    expect(starTwinkle(3, 12.5, false)).toBeGreaterThanOrEqual(0.86)
    expect(starTwinkle(3, 12.5, false)).toBeLessThanOrEqual(1)
  })
})

describe('the moon against the sun', () => {
  it('grows its glow with the lit fraction', () => {
    expect(moonGlowRadius(0)).toBe(12)
    expect(moonGlowRadius(1)).toBe(32)
  })

  it('fades out inside the sun\'s glare and is clear beyond the glow', () => {
    const touching = SUN_DISC_RADIUS + MOON_GLYPH_SIZE / 2
    const clear = SUN_GLOW_RADIUS + MOON_GLYPH_SIZE / 2
    expect(moonGlareOpacity(touching)).toBe(0)
    expect(moonGlareOpacity(touching - 5)).toBe(0)
    expect(moonGlareOpacity(clear)).toBe(1)
    expect(moonGlareOpacity(100)).toBe(1)
    expect(moonGlareOpacity((touching + clear) / 2)).toBeCloseTo(0.5)
  })
})

describe('skyPoint', () => {
  const size = { width: 400, height: 300 }

  it('scales altitude at a fixed rate, not with the frame', () => {
    const horizon = skyPoint({ azimuth: 180, altitude: 0, latitude: 48, ...size })
    const up = skyPoint({ azimuth: 180, altitude: 10, latitude: 48, ...size })
    expect(horizon.y).toBe(300)
    expect(horizon.y - up.y).toBeCloseTo(10 * SKY_ALTITUDE_SCALE)
  })

  it('puts east on the right in the northern hemisphere', () => {
    const span = { riseAz: 90, setAz: 270 }
    const rising = skyPoint({ azimuth: 90, altitude: 0, latitude: 48, span, ...size })
    const setting = skyPoint({ azimuth: 270, altitude: 0, latitude: 48, span, ...size })
    expect(rising.x).toBeCloseTo(400)
    expect(setting.x).toBeCloseTo(0)
  })

  it('keeps east on the right south of the equator too', () => {
    const span = { riseAz: 90, setAz: 270 }
    const rising = skyPoint({ azimuth: 90, altitude: 0, latitude: -33, span, ...size })
    const setting = skyPoint({ azimuth: 270, altitude: 0, latitude: -33, span, ...size })
    expect(rising.x).toBeGreaterThan(setting.x)
  })

  it('spans the whole horizon when the body has no rise and set to fit', () => {
    const meridian = skyPoint({ azimuth: 180, altitude: 45, latitude: 48, ...size })
    expect(meridian.x).toBeCloseTo(200)
  })

  it('pads by the body\'s radius so a disc clears the edge as it rises', () => {
    const span = { riseAz: 90, setAz: 270 }
    const padded = skyPoint({ azimuth: 90, altitude: 0, latitude: 48, span, pad: 8, ...size })
    expect(padded.x).toBeCloseTo(408)
  })
})
