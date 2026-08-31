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
})
