import { describe, expect, it } from 'vitest'
import { height } from './format'

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
