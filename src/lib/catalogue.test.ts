import { describe, expect, it } from 'vitest'
import tzLookup from 'tz-lookup'
import { loadCatalogue } from './catalogue'

describe('loadCatalogue', () => {
  const all = loadCatalogue()

  it('yields every station whose data ships on npm', () => {
    expect(all.length).toBe(3607)
    expect(all.filter((s) => s.kind === 'tide').length).toBe(2765)
    expect(all.filter((s) => s.kind === 'current').length).toBe(842)
  })

  it('excludes stations no data package can satisfy', () => {
    expect(all.some((s) => s.id.startsWith('chs-'))).toBe(false)
    // Registry-owned despite the noaa- name; a chs- prefix test misses it.
    expect(all.some((s) => s.id === 'noaa-boundary-pass')).toBe(false)
    expect(all.every((s) => s.id.includes('/'))).toBe(true)
  })

  it('gives every station what it needs to be predicted and addressed', () => {
    for (const s of all) {
      expect(s.slug, s.id).toMatch(/^[a-z0-9-]+$/)
      expect(s.constituents.length, s.id).toBeGreaterThan(0)
      expect(Number.isFinite(s.latitude), s.id).toBe(true)
      expect(s.name.trim(), s.id).not.toBe('')
    }
  })

  it('keeps slugs unique within a kind and allows reuse across kinds', () => {
    for (const kind of ['tide', 'current'] as const) {
      const slugs = all.filter((s) => s.kind === kind).map((s) => s.slug)
      expect(new Set(slugs).size, kind).toBe(slugs.length)
    }
  })

  it('is deterministic', () => {
    expect(loadCatalogue().map((s) => s.id)).toEqual(all.map((s) => s.id))
  })

  it('resolves the hero station, which the homepage also renders', () => {
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.name).toBe('Deception Pass (Narrows)')
    expect(d?.kind).toBe('current')
  })

  it('gives Deception Pass its real local zone, not UTC', () => {
    // The current bundle carries no timezone field at all - catalogue.ts must
    // derive one from coordinates. Asserting the zone itself, not merely that
    // one is present, is the point: a "has a timezone" check passes on 'UTC'.
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.timezone).toBe('America/Los_Angeles')
  })

  it('never silently defaults a current station to UTC', () => {
    // Every current station's timezone must match what its own coordinates
    // resolve to. A station whose zone happens to genuinely be UTC would
    // still pass, since tzLookup itself would agree - the point is that a
    // UTC result can never come from a missing-data fallback instead.
    for (const s of all.filter((s) => s.kind === 'current')) {
      expect(s.timezone, s.id).toBe(tzLookup(s.latitude, s.longitude))
    }
  })
})
