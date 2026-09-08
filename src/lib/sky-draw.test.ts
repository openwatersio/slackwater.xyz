import { describe, expect, it } from 'vitest'
import { drawSky } from './sky-draw'
import { skyDays, skyState } from './sky-state'
import type { SkySurface } from './sky-draw'

const LAT = 48.40618896484375
const LON = -122.64
const days = skyDays(LAT, LON, new Date('2026-09-08T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
const SUNRISE = new Date('2026-09-08T13:38:01Z')

function recorder() {
  const calls: string[] = []
  const alphas: number[] = []
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    ellipse: () => calls.push('ellipse'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    fill: () => {
      calls.push('fill')
      alphas.push(ctx.globalAlpha)
    },
  } as SkySurface & { globalAlpha: number }
  return { ctx, calls, alphas }
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
    drawSky(ctx, at(new Date(SUNRISE.getTime() - 4 * 3600_000)), geo)
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

  it('draws no moon while the moon is below the horizon', () => {
    const { ctx, calls } = recorder()
    // The moon sets at 01:16Z and does not rise again until 10:22Z.
    const moonDown = at(new Date('2026-09-08T05:00:00Z'))
    drawSky(ctx, moonDown, geo)
    expect(moonDown.moon!.altDeg).toBeLessThan(0)
    expect(calls).not.toContain('ellipse')
  })
})
