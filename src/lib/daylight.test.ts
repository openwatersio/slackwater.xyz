import { describe, expect, it } from 'vitest'
import { daylightSpans } from './daylight'

const MIN = 60_000
const near = (actual: Date, expected: string, minutes = 3) =>
  expect(Math.abs(actual.getTime() - Date.parse(expected)), `${actual.toISOString()} vs ${expected}`).toBeLessThanOrEqual(minutes * MIN)

describe('daylightSpans', () => {
  it("matches published sunrise and sunset times: Seattle's summer solstice", () => {
    // Seattle's solstice sunrise and sunset are about 5:11 AM and 9:11 PM PDT;
    // three minutes covers rounding and refraction conventions between tables.
    const spans = daylightSpans(new Date('2026-06-21T07:00:00Z'), new Date('2026-06-22T07:00:00Z'), 47.6062, -122.3321)
    expect(spans).toHaveLength(1)
    near(spans[0][0], '2026-06-21T12:11:00Z')
    near(spans[0][1], '2026-06-22T04:11:00Z')
  })

  it('a polar day is daylight from end to end, and a polar night has none', () => {
    const start = new Date('2026-06-21T00:00:00Z')
    const end = new Date('2026-06-22T00:00:00Z')
    expect(daylightSpans(start, end, 78.22, 15.65)).toEqual([[start, end]])
    expect(daylightSpans(new Date('2026-12-21T00:00:00Z'), new Date('2026-12-22T00:00:00Z'), 78.22, 15.65)).toEqual([])
  })

  it('draws no bands outside the years Almanac computes', () => {
    expect(daylightSpans(new Date('2150-06-21T00:00:00Z'), new Date('2150-06-22T00:00:00Z'), 47.6, -122.3)).toEqual([])
  })
})
