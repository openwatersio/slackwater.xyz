import { describe, expect, it } from 'vitest'
import { SPEED_STOPS, speedColor } from './ramp'

describe('speed ramp', () => {
  it('is the app ramp, stop for stop', () => {
    // SN.speedRampStops, Theme.swift. If this disagrees with that file, that
    // file wins — and the drift is exactly what this test exists to catch.
    expect(SPEED_STOPS).toEqual([
      [0, '#F5C96B'],
      [1 / 3, '#F5C96B'],
      [2 / 3, '#E8763C'],
      [1, '#C93A32'],
    ])
  })

  it('holds yellow to a third, then warms to red', () => {
    expect(speedColor(0)).toBe('#f5c96b')
    expect(speedColor(1 / 3)).toBe('#f5c96b')
    expect(speedColor(2 / 3)).toBe('#e8763c')
    expect(speedColor(1)).toBe('#c93a32')
  })

  it('clamps rather than wrapping', () => {
    expect(speedColor(-1)).toBe(speedColor(0))
    expect(speedColor(4)).toBe(speedColor(1))
  })

  it('never contains green — green means slack', () => {
    for (let t = 0; t <= 1; t += 0.02) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(speedColor(t).slice(i, i + 2), 16))
      expect(g > r + 20 && g > b + 20).toBe(false)
    }
  })

  it('cools its green channel monotonically, so hotter never reads calmer', () => {
    let prev = 256
    for (let t = 0; t <= 1; t += 0.02) {
      const g = parseInt(speedColor(t).slice(3, 5), 16)
      expect(g).toBeLessThanOrEqual(prev)
      prev = g
    }
  })
})
