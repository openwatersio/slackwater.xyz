import { describe, expect, it } from 'vitest'
import { fadeStops } from './fade'

describe('fadeStops', () => {
  it('holds the past at 35% and the future at full, split at now', () => {
    const stops = fadeStops(0.5)
    expect(stops.map((s) => s.offset)).toEqual([0, 0.06, 0.5, 0.5, 0.94, 1])
    expect(stops.map((s) => s.opacity)).toEqual([0, 0.35, 0.35, 1, 1, 0])
  })

  it('fades nothing for a window still ahead, and everything for one behind', () => {
    expect(fadeStops(-2).every((s) => s.offset > 0 ? s.opacity >= 1 || s.offset === 1 : true)).toBe(true)
    expect(fadeStops(3).filter((s) => s.offset > 0 && s.offset < 1).every((s) => s.opacity === 0.35)).toBe(true)
  })

  it('keeps the stops in offset order whatever now is', () => {
    for (const n of [0.01, 0.5, 0.97]) {
      const offsets = fadeStops(n).map((s) => s.offset)
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets)
    }
  })
})
