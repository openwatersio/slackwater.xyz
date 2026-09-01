import { describe, expect, it } from 'vitest'
import { datumLine, pageDescription, provenance } from './copy'
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

  it('names CHS as the publisher, which is only true once the curve is drawn', () => {
    // The identity panel may not say this (#44): nine of the 23 gates are
    // never fitted on device and nothing published says which nine, so any
    // sentence naming a mechanism is false for one group or the other. That
    // constraint does not reach here. What this clause describes is a curve
    // the reader's browser fetched from DFO, which is CHS's own published
    // prediction for every gate without exception.
    expect(provenance(chs)).toBe('published by the Canadian Hydrographic Service')
  })

  it('claims nothing about the app, on either branch', () => {
    // "Slackwater's on-device model" is app copy and false on a page showing
    // DFO's own numbers; "offline" is false for the online gates.
    for (const s of [bundled, chs]) {
      expect(provenance(s)).not.toMatch(/slackwater|offline|on-device|app/i)
    }
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

describe('datumLine', () => {
  it('names a bundled station\'s own datum code', () => {
    expect(datumLine({ ...bundled, kind: 'tide', chartDatum: 'MLLW' })).toBe(
      'MLLW datum · computed from harmonic constituents',
    )
  })

  it('names chart datum for a CHS port, and no code', () => {
    // DFO publishes on chart datum and states no code for it. Victoria's own
    // metadata puts LLWLT at -0.09 m — nine centimetres BELOW the zero those
    // heights are quoted from — so borrowing the corpus's vocabulary here
    // would be a precise claim and a wrong one.
    expect(datumLine({ ...chs, kind: 'tide' })).toBe(
      'Chart datum · published by the Canadian Hydrographic Service',
    )
  })
})
