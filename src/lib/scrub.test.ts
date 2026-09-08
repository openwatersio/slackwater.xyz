import { describe, expect, it } from 'vitest'
import { INTRO_DURATION_SECONDS, INTRO_HOLD_SECONDS, introProgress, introTime, introWindow } from './scrub'
import { countdown } from './format'
import { HERO_STATION } from './currents'

describe('introWindow', () => {
  it('rests two hours after the sunrise nearest the moment it is given', () => {
    const { to } = introWindow(HERO_STATION, new Date('2026-09-08T18:00:00Z'))
    // Sunrise at Deception Pass on 2026-09-08 is 13:38:01Z.
    expect(to.toISOString()).toMatch(/^2026-09-08T15:38/)
  })

  it('starts four hours before that sunrise, which is dark', () => {
    const { from, to } = introWindow(HERO_STATION, new Date('2026-09-08T18:00:00Z'))
    expect(to.getTime() - from.getTime()).toBe(6 * 3600_000)
    expect(from.toISOString()).toMatch(/^2026-09-08T09:38/)
  })

  it('picks the same window whether the visitor loads before or after that sunrise', () => {
    const early = introWindow(HERO_STATION, new Date('2026-09-08T11:00:00Z'))
    const late = introWindow(HERO_STATION, new Date('2026-09-08T20:00:00Z'))
    expect(early.to.toISOString()).toBe(late.to.toISOString())
  })
})

describe('introProgress', () => {
  it('holds at the start so the star field registers before anything moves', () => {
    expect(introProgress(0)).toBe(0)
    expect(introProgress(INTRO_HOLD_SECONDS)).toBe(0)
  })

  it('eases in and out rather than running at a constant rate', () => {
    expect(introProgress(INTRO_HOLD_SECONDS + 2.5)).toBeCloseTo(0.5)
    expect(introProgress(INTRO_HOLD_SECONDS + 0.5)).toBeLessThan(0.1)
    expect(introProgress(INTRO_HOLD_SECONDS + 4.5)).toBeGreaterThan(0.9)
  })

  it('is finished at the end and stays finished', () => {
    expect(introProgress(INTRO_DURATION_SECONDS)).toBe(1)
    expect(introProgress(600)).toBe(1)
  })
})

describe('introTime', () => {
  const from = new Date('2026-09-08T09:38:00Z')
  const to = new Date('2026-09-08T15:38:00Z')

  it('is the night start until the hold is over', () => {
    expect(introTime(from, to, 0).toISOString()).toBe(from.toISOString())
  })

  it('lands exactly on the rest moment', () => {
    expect(introTime(from, to, INTRO_DURATION_SECONDS).toISOString()).toBe(to.toISOString())
  })
})

describe('countdown', () => {
  it('reads minutes under the hour and hours above it', () => {
    const t = new Date('2026-09-08T12:00:00Z')
    expect(countdown(t, new Date('2026-09-08T12:42:00Z'))).toBe('42m')
    expect(countdown(t, new Date('2026-09-08T14:14:00Z'))).toBe('2h 14m')
  })

  it('floors at zero rather than counting backwards', () => {
    const t = new Date('2026-09-08T12:00:00Z')
    expect(countdown(t, new Date('2026-09-08T11:00:00Z'))).toBe('0m')
  })
})
