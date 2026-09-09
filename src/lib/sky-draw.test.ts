import { describe, expect, it } from 'vitest'
import { drawSky } from './sky-draw'
import { MOON_GLYPH_SIZE, SUN_DISC_RADIUS } from './sky'
import { skyDays, skyState } from './sky-state'
import type { SkySurface } from './sky-draw'

const LAT = 48.40618896484375
const LON = -122.64
const days = skyDays(LAT, LON, new Date('2026-09-08T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
const SUNRISE = new Date('2026-09-08T13:38:01Z')

function recorder() {
  const calls: string[] = []
  const alphas: number[] = []
  const arcs: number[] = []
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    arc: (_x: number, _y: number, r: number) => {
      calls.push('arc')
      arcs.push(r)
    },
    ellipse: () => calls.push('ellipse'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    createRadialGradient: () => {
      calls.push('gradient')
      return { addColorStop: () => {} } as CanvasGradient
    },
    fill: () => {
      calls.push('fill')
      alphas.push(ctx.globalAlpha)
    },
  } as SkySurface & { globalAlpha: number }
  return { ctx, calls, alphas, arcs }
}

const geo = { width: 400, height: 300, seconds: 0, reduceMotion: true }

const at = (time: Date) => skyState({ time, latitude: LAT, longitude: LON, days })

describe('drawSky', () => {
  it('draws a star field at night and none of it by day', () => {
    const night = recorder()
    const day = recorder()
    drawSky(night.ctx, at(new Date(SUNRISE.getTime() - 4 * 3600_000)), geo)
    drawSky(day.ctx, at(new Date(SUNRISE.getTime() + 6 * 3600_000)), geo)
    const fills = (r: ReturnType<typeof recorder>) => r.calls.filter((c) => c === 'fill').length
    expect(fills(night)).toBeGreaterThan(20)
    // By day only the bodies remain: two fills for the sun, at most two for the moon.
    expect(fills(day)).toBeLessThan(6)
  })

  it('fades stars through the ramp instead of drawing them at full strength', () => {
    const { ctx, alphas, calls } = recorder()
    const night = at(new Date(SUNRISE.getTime() - 4 * 3600_000))
    // Only stars are drawn here, which is what makes the cap below meaningful:
    // a body's glow carries its own alpha and would swamp it.
    expect(night.sun!.altDeg).toBeLessThan(-6)
    expect(night.moon!.altDeg).toBeLessThan(0)
    drawSky(ctx, night, geo)
    // starOpacity caps at 0.7; anything above means the ramp was bypassed.
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.7)
    // The haze guard drops stars below the horizon, so not all 288 are drawn.
    expect(calls.filter((c) => c === 'fill').length).toBeLessThan(288)
  })

  it('balances every save with a restore', () => {
    const { ctx, calls } = recorder()
    drawSky(ctx, at(SUNRISE), geo)
    expect(calls.filter((c) => c === 'save')).toHaveLength(calls.filter((c) => c === 'restore').length)
  })

  it('gives the bodies a soft glow rather than a flat ring', () => {
    const { ctx, calls } = recorder()
    // Mid-morning: the sun is well up and the moon is still above the horizon.
    drawSky(ctx, at(new Date(SUNRISE.getTime() + 3 * 3600_000)), geo)
    expect(calls.filter((c) => c === 'gradient').length).toBeGreaterThanOrEqual(2)
  })

  it('scales the bodies with the band, so the sun is not a dot in a tall sky', () => {
    const state = at(new Date(SUNRISE.getTime() + 3 * 3600_000))
    const short = recorder()
    const tall = recorder()
    // 186px is the app's own band at three pixels per degree; 744 is four of it.
    drawSky(short.ctx, state, { ...geo, height: 186 })
    drawSky(tall.ctx, state, { ...geo, height: 744 })
    // The widest arc is the glow's reach; the disc is checked by name, since a
    // glow that scaled while the disc did not would satisfy the first alone.
    expect(Math.max(...tall.arcs)).toBeCloseTo(Math.max(...short.arcs) * 4, 0)
    expect(short.arcs).toContain(SUN_DISC_RADIUS)
    expect(tall.arcs).toContain(SUN_DISC_RADIUS * 4)
  })

  it('draws the moon on its own dark limb, not as a floating sliver', () => {
    const { ctx, arcs } = recorder()
    // Near a new moon the lit region is a thin crescent; the limb disc is what
    // makes it read as a moon at all.
    const state = at(new Date(SUNRISE.getTime() + 3 * 3600_000))
    expect(state.illumination!.fraction).toBeLessThan(0.15)
    drawSky(ctx, state, geo)
    const stretch = geo.height / (62 * 3)
    expect(arcs).toContain((MOON_GLYPH_SIZE / 2) * stretch)
  })

  it('draws no moon while the moon is below the horizon', () => {
    const { ctx, calls } = recorder()
    // The moon sets at 01:16Z and does not rise again until 10:22Z.
    const moonDown = at(new Date('2026-09-08T05:00:00Z'))
    drawSky(ctx, moonDown, geo)
    expect(moonDown.moon!.altDeg).toBeLessThan(0)
    expect(calls).not.toContain('ellipse')
  })
})
