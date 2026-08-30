import { describe, expect, it } from 'vitest'
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
})
