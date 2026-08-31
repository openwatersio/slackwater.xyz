import { describe, expect, it } from 'vitest'
import { pageDescription, provenance } from './copy'
import type { BundledStation, ChsStation } from './station'

const bundled = {
  id: 'noaa/x', kind: 'current', slug: 'x', name: 'Deception Pass', source: 'bundled',
  latitude: 0, longitude: 0, timezone: 'UTC', constituents: [],
} satisfies BundledStation

const chs = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('provenance', () => {
  it('names harmonic constituents for a bundled station', () => {
    expect(provenance(bundled)).toBe('computed from harmonic constituents')
  })

  it('never claims a computation for a CHS station', () => {
    expect(provenance(chs)).not.toMatch(/comput/i)
  })
})

describe('pageDescription', () => {
  it('promises predictions only where the page has them', () => {
    expect(pageDescription(bundled)).toMatch(/Slack water and maximum flood and ebb/)
  })

  it('promises no predictions on an identity-only page', () => {
    // Exact, not a denylist: the previous version listed four retired phrases,
    // which let a new false claim through in different words.
    expect(pageDescription(chs)).toBe(
      'Station information for Dodd Narrows, Nanaimo. Predictions are based on ' +
        'Canadian Hydrographic Service data and are available in the Slackwater app.',
    )
  })
})
