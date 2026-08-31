import { describe, expect, it } from 'vitest'
import { parseInstant } from './instant-url'

describe('parseInstant', () => {
  it('accepts an offset-bearing ISO instant', () => {
    expect(parseInstant('2026-08-30T14:30-07:00')?.toISOString()).toBe('2026-08-30T21:30:00.000Z')
  })

  it('round-trips through the same offset', () => {
    const iso = '2026-08-30T14:30-07:00'
    expect(parseInstant(iso)).toEqual(parseInstant(iso))
  })

  it('rejects junk rather than rendering an arbitrary moment', () => {
    for (const bad of ['', 'now', '2026-13-45T99:99Z', '../../etc/passwd']) {
      expect(parseInstant(bad), bad).toBeUndefined()
    }
  })

  it('rejects a day that does not exist in its month, rather than rolling over', () => {
    // Date() silently normalizes day overflow (Feb 30 -> Mar 2) instead of
    // producing Invalid Date the way it does for month/hour overflow. A
    // mistyped day must 404, not silently serve a different moment.
    for (const bad of ['2026-02-30T10:00Z', '2026-04-31T10:00Z', '2025-02-29T10:00Z']) {
      expect(parseInstant(bad), bad).toBeUndefined()
    }
  })

  it('still accepts Feb 29 in a leap year and Dec 31 at year end', () => {
    expect(parseInstant('2024-02-29T10:00Z')).toBeInstanceOf(Date)
    expect(parseInstant('2026-12-31T23:59Z')).toBeInstanceOf(Date)
  })
})
