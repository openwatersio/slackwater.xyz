import { describe, expect, it } from 'vitest'
import { chartTime, compass16, dayStart, height } from './format'

describe('height', () => {
  it('never renders a negative zero', () => {
    // The 33 pages in #34: a low between -0.05 and 0 that `toFixed(1)` reports
    // faithfully as "-0.0". No reading of the water makes that the right label.
    for (const n of [-0.0499, -0.04, -0.01, -1e-9, -0]) {
      expect(height(n), `${n}`).toBe('0.0')
    }
  })

  it('keeps every other number exactly where toFixed puts it', () => {
    // A guard that swallowed a real negative would hide a station below datum,
    // which is a true reading (#34 part 3) and must survive.
    expect(height(-0.05)).toBe('-0.1')
    expect(height(-0.06)).toBe('-0.1')
    expect(height(-4.35)).toBe('-4.3') // toFixed's own rounding, not ours
    expect(height(0)).toBe('0.0')
    expect(height(0.04)).toBe('0.0')
    expect(height(6.24)).toBe('6.2')
  })
})

describe('chartTime', () => {
  it('reads the way the app reads, twelve-hour and lowercase', () => {
    // 14:42Z is 07:42 in Pacific daylight time.
    expect(chartTime(new Date('2026-09-08T14:42:00Z'), 'America/Los_Angeles')).toBe('7:42am')
  })

  it('names both twelves without a leading zero', () => {
    expect(chartTime(new Date('2026-09-08T07:15:00Z'), 'America/Los_Angeles')).toBe('12:15am')
    expect(chartTime(new Date('2026-09-08T19:15:00Z'), 'America/Los_Angeles')).toBe('12:15pm')
  })

  it('leaves no space before the meridiem, whichever space the platform used', () => {
    // Newer ICU emits U+202F rather than a plain space before AM/PM.
    expect(chartTime(new Date('2026-09-08T14:42:00Z'), 'America/Los_Angeles')).not.toMatch(/\s/)
  })
})

describe('compass16', () => {
  it('names the sixteen points', () => {
    expect(compass16(0)).toBe('N')
    expect(compass16(22.5)).toBe('NNE')
    expect(compass16(90)).toBe('E')
    expect(compass16(180)).toBe('S')
    expect(compass16(270)).toBe('W')
    expect(compass16(292.5)).toBe('WNW')
  })

  it('wraps past north rather than running off the end', () => {
    expect(compass16(350)).toBe('N')
    expect(compass16(360)).toBe('N')
    expect(compass16(720)).toBe('N')
  })

  it('takes a negative bearing', () => {
    expect(compass16(-90)).toBe('W')
  })
})

describe('dayStart', () => {
  const LA = 'America/Los_Angeles'
  const hours = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 3600_000

  it('lands on local midnight, not the runtime one', () => {
    // 2026-09-08 07:30Z is 00:30 Pacific — the day started half an hour ago,
    // and a UTC-based floor would put it 7.5 hours in the future.
    expect(dayStart(new Date('2026-09-08T07:30:00Z'), LA).toISOString()).toBe('2026-09-08T07:00:00.000Z')
  })

  it('adds days on the local calendar, so a spring-forward day is 23 hours', () => {
    // 2026-03-08 is the US DST transition. Adding 24h to midnight lands at
    // 01:00 on the 9th, not midnight, and every window built on it is an hour out.
    const d = new Date('2026-03-08T12:00:00Z')
    expect(hours(dayStart(d, LA), dayStart(d, LA, 1))).toBe(23)
  })

  it('is 24 hours on an ordinary day', () => {
    const d = new Date('2026-09-08T12:00:00Z')
    expect(hours(dayStart(d, LA), dayStart(d, LA, 1))).toBe(24)
  })

  it('works east of Greenwich, where local midnight is the previous UTC day', () => {
    // 2026-09-08 12:00Z is 2026-09-09 00:00 in Auckland — exactly midnight there.
    expect(dayStart(new Date('2026-09-08T12:00:00Z'), 'Pacific/Auckland').toISOString()).toBe(
      '2026-09-08T12:00:00.000Z',
    )
    expect(hours(dayStart(new Date('2026-09-08T23:00:00Z'), 'Pacific/Auckland'), dayStart(new Date('2026-09-08T23:00:00Z'), 'Pacific/Auckland', 1))).toBe(24)
  })
})
