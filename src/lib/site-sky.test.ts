import { describe, expect, it } from 'vitest'
import { moonAltAz, moonEvents, sunAltAz, sunEvents } from '@openwaters/almanac'
import { locationSky, skyPaint, stylizedSky, transitionSky } from './site-sky'

const observer = { latitude: 48.4284, longitude: -123.3656 }

describe('skyPaint', () => {
  it.each([
    [5, '#2d65a7', '#dbc2ad'],
    [-3, '#213862', '#c37661'],
    [-9, '#111d3d', '#5c3a5b'],
    [-15, '#080d20', '#1b1d3b'],
  ] as const)('interpolates the adjacent anchors at %s degrees', (altitude, top, bottom) => {
    expect(skyPaint(altitude)).toEqual({ top, bottom })
  })

  it('uses the five approved solar anchors', () => {
    expect(skyPaint(10)).toEqual({ top: '#2f7fd4', bottom: '#bde3fb' })
    expect(skyPaint(0)).toEqual({ top: '#2b4a7a', bottom: '#f8a15f' })
    expect(skyPaint(-18)).toEqual({ top: '#04060f', bottom: '#0b1023' })
  })
})

it('keeps stylized modes stable', () => {
  expect(stylizedSky('light').sun?.x).toBe(0.72)
  expect(stylizedSky('light').sun?.y).toBeCloseTo(0.0088576)
  expect(stylizedSky('night').moon?.x).toBe(0.72)
  expect(stylizedSky('night').moon?.y).toBeCloseTo(0.0088576)
  expect(stylizedSky('night').moon?.fraction).toBe(1)
})

it('keeps both bodies on one arc in every mode and transition', () => {
  const sun = locationSky(observer, new Date('2026-09-12T19:00:00Z'))
  const moon = locationSky(observer, new Date('2026-09-01T06:00:00Z'))
  const frames = [
    stylizedSky('light'), stylizedSky('night'), sun, moon,
    transitionSky(stylizedSky('night'), stylizedSky('light'), 0.35),
    transitionSky(stylizedSky('light'), sun, 0.35),
    transitionSky(moon, stylizedSky('night'), 0.35),
  ]
  for (const frame of frames) for (const body of [frame.sun, frame.moon]) {
    if (body) expect(body.y).toBeCloseTo(0.016 * (2 * body.x - 1) ** 2 + 0.008 * body.x)
  }
})

it('brings the next body from the right and sets the old one on the left', () => {
  const frame = transitionSky(stylizedSky('night'), stylizedSky('light'), 0.5)
  expect(frame.sun!.x).toBeGreaterThan(0.72)
  expect(frame.moon!.x).toBeLessThan(0.72)
})

it('places sunrise on the east (right) and sunset on the west (left)', () => {
  const almanacObserver = { latitudeDeg: observer.latitude, longitudeDeg: observer.longitude }
  const events = sunEvents(new Date('2026-09-12T00:00:00Z'), new Date('2026-09-14T00:00:00Z'), almanacObserver)
  const rise = events.find((event) => event.kind === 'rise')!
  const set = events.find((event) => event.kind === 'set' && event.time > rise.time)!
  const morning = locationSky(observer, new Date(rise.time.getTime() + 10 * 60_000)).sun
  const evening = locationSky(observer, new Date(set.time.getTime() - 10 * 60_000)).sun
  expect(morning?.x).toBeGreaterThan(0.8)
  expect(evening?.x).toBeLessThan(0.2)
})

it('draws only the literal nighttime body', () => {
  const moonless = locationSky(observer, new Date('2026-09-12T07:00:00Z'))
  expect(moonless.sun).toBeUndefined()
  expect(moonless.moon).toBeUndefined()
})

it('draws the literal daytime sun through a west-coast sunset', () => {
  const frame = locationSky(
    { latitude: 47.6062, longitude: -122.3321 },
    new Date('2026-09-12T17:06:00Z'),
  )
  expect(frame.sun).toBeDefined()
})

it('draws a sun whose rise was before UTC midnight', () => {
  const frame = locationSky(
    { latitude: 35.6762, longitude: 139.6503 },
    new Date('2026-09-12T00:30:00Z'),
  )
  expect(frame.sun).toBeDefined()
})

it.each([
  ['sun', '2026-09-12T17:06:00Z'],
  ['moon', '2026-09-01T06:00:00Z'],
] as const)('keeps the location %s on the high arc', (body, instant) => {
  const position = locationSky(observer, new Date(instant))[body]
  expect(position).toBeDefined()
  expect(position!.y).toBeGreaterThanOrEqual(0)
  expect(position!.y).toBeLessThanOrEqual(0.03)
})

it.each([
  ['2026-09-01T06:00:00Z', { latitude: 48.4284, longitude: -123.3656 }, -1, 1],
  ['2026-09-18T03:00:00Z', { latitude: 48.4284, longitude: -123.3656 }, 1, 1],
  ['2026-09-20T09:00:00Z', { latitude: -33.8688, longitude: 151.2093 }, -1, -1],
] as const)('points the lunar limb toward the sun across north and the zenith at %s', (instant, observer, right, down) => {
  const moon = locationSky(observer, new Date(instant)).moon
  expect(moon).toBeDefined()
  expect(Math.sign(Math.cos(moon!.lightAngle))).toBe(right)
  expect(Math.sign(Math.sin(moon!.lightAngle))).toBe(down)
})

it.each([
  ['sun', '2026-06-21T12:00:00Z'],
  ['moon', '2026-12-22T00:00:00Z'],
] as const)('keeps the circumpolar %s visible without rise/set events', (body, instant) => {
  const observer = { latitude: 69.6492, longitude: 18.9553 }
  const almanacObserver = { latitudeDeg: observer.latitude, longitudeDeg: observer.longitude }
  const at = new Date(instant)
  const start = new Date(at)
  start.setUTCHours(-24, 0, 0, 0)
  const end = new Date(start.getTime() + 72 * 60 * 60_000)
  const events = body === 'sun' ? sunEvents(start, end, almanacObserver).filter((event) => event.kind === 'rise' || event.kind === 'set') : moonEvents(start, end, almanacObserver)
  const altitude = (body === 'sun' ? sunAltAz : moonAltAz)(at, almanacObserver).altDeg
  expect(events).toEqual([])
  expect(altitude).toBeGreaterThan(0)
  const position = locationSky(observer, at)[body]
  expect(position).toBeDefined()
  expect(position!.x).toBeGreaterThan(0)
  expect(position!.x).toBeLessThan(1)
  expect(position!.y).toBeGreaterThanOrEqual(0)
  expect(position!.y).toBeLessThanOrEqual(0.03)
  const later = locationSky(observer, new Date(at.getTime() + 60 * 60_000))[body]
  expect(later!.x).not.toBeCloseTo(position!.x)
})

it('starts and ends a passing-orbits transition exactly at its inputs', () => {
  const from = stylizedSky('night')
  const to = stylizedSky('light')
  expect(transitionSky(from, to, 0)).toEqual(from)
  expect(transitionSky(from, to, 1)).toEqual(to)
})

it('sends the outgoing moon left and brings the sun from the right', () => {
  const moon = transitionSky(stylizedSky('night'), stylizedSky('light'), 0.5).moon
  expect(moon).toBeDefined()
  expect(moon?.x).toBeCloseTo(0.335)
  const sun = transitionSky(stylizedSky('night'), stylizedSky('light'), 0.5).sun
  expect(sun?.x).toBeCloseTo(0.885)
})

it('keeps the incoming location sun on the same arc', () => {
  const to = locationSky(observer, new Date('2026-09-12T19:00:00Z'))
  const halfway = transitionSky(stylizedSky('night'), to, 0.5)
  expect(halfway.sun).toBeDefined()
  expect(halfway.sun!.y).toBeCloseTo(0.016 * (2 * halfway.sun!.x - 1) ** 2 + 0.008 * halfway.sun!.x)
})

it('keeps large and minute same-body moves on the same arc', () => {
  const from = { ...stylizedSky('light'), sun: { x: 0.2, y: 0.00736 } }
  const far = { ...stylizedSky('light'), sun: { x: 0.8, y: 0.01216 } }
  const near = { ...stylizedSky('light'), sun: { x: 0.21, y: 0.0070624 } }
  expect(transitionSky(from, far, 0.25).sun?.y).toBeCloseTo(0.00424)
  expect(transitionSky(from, near, 0.5).sun?.y).toBeCloseTo(0.0072096)
})
