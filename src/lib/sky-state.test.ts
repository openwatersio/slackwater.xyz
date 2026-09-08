import { describe, expect, it } from 'vitest'
import { skyDays, skyState } from './sky-state'

const LAT = 48.40618896484375
const LON = -122.64
const FROM = new Date('2026-09-08T00:00:00Z')
const TO = new Date('2026-09-10T00:00:00Z')
const days = skyDays(LAT, LON, FROM, TO)
// The rise Almanac itself reports, not a literal: `span` selects the last rise
// at or before the moment, and a literal truncated to the second falls before
// the real crossing, so the span it is meant to find comes back undefined.
const SUNRISE = days.sunRises[0]

describe('skyDays', () => {
  it('finds both bodies rising and setting across the window', () => {
    expect(days.sunRises.length).toBeGreaterThanOrEqual(2)
    expect(days.sunSets.length).toBeGreaterThanOrEqual(1)
    expect(days.moonRises.length).toBeGreaterThanOrEqual(1)
    expect(days.moonSets.length).toBeGreaterThanOrEqual(1)
  })

  it('returns only crossings, not the twilights Almanac also reports', () => {
    for (const t of days.sunRises) {
      expect(t.getTime()).toBeGreaterThanOrEqual(FROM.getTime())
      expect(t.getTime()).toBeLessThanOrEqual(TO.getTime())
    }
    expect(days.sunRises[0].toISOString()).toMatch(/^2026-09-08T13:38/)
  })
})

describe('skyState', () => {
  const atSunrise = skyState({ time: SUNRISE, latitude: LAT, longitude: LON, days })
  const atNight = skyState({
    time: new Date(SUNRISE.getTime() - 4 * 3600_000), latitude: LAT, longitude: LON, days,
  })

  it('places the sun on the horizon at the rise it was given', () => {
    expect(atSunrise.sun!.altDeg).toBeCloseTo(-0.21, 1)
    expect(atSunrise.sun!.azDeg).toBeCloseTo(80.7, 0)
  })

  it('places every catalogue star', () => {
    expect(atSunrise.stars).toHaveLength(288)
    expect(atSunrise.stars[0].magnitude).toBe(-1.44)
  })

  it('spans the sun from the rise behind the moment to the set ahead of it', () => {
    expect(atSunrise.sunSpan).toBeDefined()
    expect(atSunrise.sunSpan!.riseAz).toBeCloseTo(80.7, 0)
    expect(atSunrise.sunSpan!.setAz).toBeGreaterThan(180)
  })

  it('paints night dark and dawn lighter, and never mutes the night gradient', () => {
    expect(atNight.paint.top).toBe('#04060f')
    expect(atNight.opacity).toBe(1)
    expect(atSunrise.opacity).toBeLessThan(1)
  })

  it('reports the moon’s lit fraction, not a phase name', () => {
    expect(atSunrise.illumination!.fraction).toBeCloseTo(0.084, 2)
  })

  it('aims the moon’s terminator, and flips it across the equator', () => {
    const south = skyState({ time: SUNRISE, latitude: -LAT, longitude: LON, days })
    expect(atSunrise.moonLightAngle).not.toBe(0)
    expect(atSunrise.moonLightAngle).not.toBeCloseTo(south.moonLightAngle, 6)
  })
})
