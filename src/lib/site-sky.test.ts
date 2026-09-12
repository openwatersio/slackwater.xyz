import { describe, expect, it } from 'vitest'
import { locationSky, skyPaint, stylizedSky, transitionSky } from './site-sky'

const observer = { latitude: 48.4284, longitude: -123.3656 }

describe('skyPaint', () => {
  it('uses the five approved solar anchors', () => {
    expect(skyPaint(10)).toEqual({ top: '#2f7fd4', bottom: '#bde3fb' })
    expect(skyPaint(0)).toEqual({ top: '#2b4a7a', bottom: '#f8a15f' })
    expect(skyPaint(-18)).toEqual({ top: '#04060f', bottom: '#0b1023' })
  })
})

it('keeps stylized modes stable', () => {
  expect(stylizedSky('light').sun).toMatchObject({ x: 0.72, y: 0.18 })
  expect(stylizedSky('night').moon).toMatchObject({ x: 0.72, y: 0.18, fraction: 1 })
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

it('starts and ends a passing-orbits transition exactly at its inputs', () => {
  const from = stylizedSky('night')
  const to = stylizedSky('light')
  expect(transitionSky(from, to, 0)).toEqual(from)
  expect(transitionSky(from, to, 1)).toEqual(to)
})

it('sends the outgoing moon off-screen during a night-to-light transition', () => {
  const moon = transitionSky(stylizedSky('night'), stylizedSky('light'), 0.5).moon
  expect(moon).toBeDefined()
  expect(moon?.x).toBeCloseTo(0.335)
})
