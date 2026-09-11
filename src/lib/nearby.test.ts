import { describe, expect, it } from 'vitest'
import { bearing, distanceNm, nearby } from './nearby'
import { compass16 } from './format'
import type { Station } from './station'

const at = (id: string, kind: Station['kind'], lat: number, lon: number): Station => ({
  id, kind, slug: id, name: id, latitude: lat, longitude: lon, timezone: 'UTC',
  source: 'bundled', constituents: [],
})

describe('distanceNm', () => {
  it('measures a known separation in nautical miles', () => {
    // One degree of latitude is 60 nautical miles by definition — if this drifts,
    // the unit label on every "Nearby" list is wrong.
    expect(distanceNm(at('a', 'tide', 0, 0), at('b', 'tide', 1, 0))).toBeCloseTo(60, 0)
  })
})

describe('nearby', () => {
  const all = [
    at('here', 'tide', 48.0, -123.0),
    at('close', 'tide', 48.1, -123.0),
    at('far', 'tide', 49.0, -123.0),
    at('current-next-door', 'current', 48.01, -123.0),
  ]

  it('orders by distance and excludes the station itself', () => {
    expect(nearby(all[0], all).map((s) => s.id)).toEqual(['close', 'far'])
  })

  it('never crosses kinds, however close the other kind is', () => {
    // `current-next-door` is nearer than either tide station. A reader following
    // "nearby tide stations" must not land on a current page.
    expect(nearby(all[0], all).map((s) => s.id)).not.toContain('current-next-door')
  })

  it('honours k', () => {
    expect(nearby(all[0], all, 1).map((s) => s.id)).toEqual(['close'])
  })
})

describe('bearing', () => {
  const SEATTLE = { latitude: 47.6062, longitude: -122.3321 }
  const VICTORIA = { latitude: 48.4284, longitude: -123.3656 }

  it('reads the great-circle course, not a compass rose guess', () => {
    // Victoria is up and left of Seattle: northwest, and far enough west of
    // due NW that a flat-earth atan2 on raw degrees — which ignores the
    // cos(latitude) squeeze on longitude — reads about 309 instead.
    expect(bearing(SEATTLE, VICTORIA)).toBeCloseTo(320.3, 1)
    expect(compass16(bearing(SEATTLE, VICTORIA))).toBe('NW')
  })

  it('calls due north zero and due south 180', () => {
    const here = { latitude: 48, longitude: -123 }
    expect(bearing(here, { latitude: 49, longitude: -123 })).toBeCloseTo(0, 6)
    expect(bearing(here, { latitude: 47, longitude: -123 })).toBeCloseTo(180, 6)
  })

  it('stays inside 0-360 rather than going negative to the west', () => {
    // atan2 returns -90 for due west; a bearing of -90 renders as a compass
    // point off the end of the sixteen.
    const b = bearing({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: -1 })
    expect(b).toBeCloseTo(270, 6)
    expect(b).toBeGreaterThanOrEqual(0)
  })
})
