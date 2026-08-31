import { describe, expect, it } from 'vitest'
import { curatedBySlug } from './registry'

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
