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
