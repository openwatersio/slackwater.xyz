import { describe, expect, it } from 'vitest'
import stars from './stars.json' with { type: 'json' }

describe('star catalogue', () => {
  it("is the app's own cut, brightest first", () => {
    expect(stars).toHaveLength(288)
    expect(stars[0]).toEqual([101.287, -16.716, -1.44])
  })

  it('carries degrees, not radians or hours', () => {
    for (const [ra, dec, mag] of stars) {
      expect(ra).toBeGreaterThanOrEqual(0)
      expect(ra).toBeLessThan(360)
      expect(Math.abs(dec)).toBeLessThanOrEqual(90)
      expect(mag).toBeLessThanOrEqual(3.5)
    }
  })
})
