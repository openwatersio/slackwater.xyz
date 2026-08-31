import { describe, expect, it } from 'vitest'
import { distanceNm, nearby } from './nearby'
import type { Station } from './station'

const at = (id: string, kind: Station['kind'], lat: number, lon: number): Station => ({
  id, kind, slug: id, name: id, latitude: lat, longitude: lon, timezone: 'UTC', constituents: [],
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
