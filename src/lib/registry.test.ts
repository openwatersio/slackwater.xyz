import { describe, expect, it } from 'vitest'
import { chsGates, curatedBySlug } from './registry'

describe('curatedBySlug', () => {
  it('carries the curated name and region for a registry station', () => {
    const entry = curatedBySlug('current').get('boundary-pass')
    expect(entry?.name).toBe('Boundary Pass')
    expect(entry?.region).toBe('Saturna & Patos Islands')
  })

  it('keys by slug, so a provider row and its registry twin agree', () => {
    // noaa-boundary-pass (registry) and noaa/PUG1717 (provider) are one
    // station 1.5 m apart, merged onto one slug in station-metadata 4.1.2.
    expect(curatedBySlug('current').has('boundary-pass')).toBe(true)
  })
})

describe('chsGates', () => {
  it('yields every CHS current gate the registry publishes, less the excluded one', () => {
    const gates = chsGates()
    expect(gates.length).toBe(23)
    expect(gates.every((g) => g.source === 'chs')).toBe(true)
  })

  it('excludes chs-arran-rapids by name', () => {
    // slackwater-ios excludes it fully as a hazard call - wrong water under a
    // trusted name - and whether the web may name it is an open owner
    // decision. The registry publishes it, so only an explicit rule keeps it
    // out. Do not remove this without that decision.
    expect(chsGates().some((g) => g.id === 'chs-arran-rapids')).toBe(false)
  })

  it('names Dodd Narrows, the flagship gate', () => {
    const dodd = chsGates().find((g) => g.id === 'chs-dodd-narrows')
    expect(dodd?.name).toBe('Dodd Narrows')
    expect(dodd?.slug).toBe('dodd-narrows')
    expect(dodd?.region).toBe('Nanaimo')
    expect(dodd?.timezone).toBe('America/Vancouver')
  })
})

describe('chsGates and the derived gate', () => {
  const gates = chsGates()

  it('marks the one gate with no CHS current station of its own', () => {
    // Malibu Rapids is derived: slack is Point Atkinson's high and low water
    // plus a fixed lag. Its position resolves to Sechelt Rapids 47 km away
    // down another inlet, so without this flag its page would either offer a
    // button that fails or, far worse, draw a real curve for the wrong water.
    const derived = gates.filter((g) => g.derived).map((g) => g.id)
    expect(derived).toEqual(['chs-malibu-rapids'])
  })

  it('leaves every fetchable gate unflagged', () => {
    // The other 22 all serve wcsp1 at their own published position, worst
    // match 0.17 km. A flag creeping onto one of them silently removes its
    // curve, and the page would still render and still look finished.
    expect(gates.find((g) => g.id === 'chs-dodd-narrows')?.derived).toBeUndefined()
    expect(gates.filter((g) => !g.derived)).toHaveLength(22)
  })
})
