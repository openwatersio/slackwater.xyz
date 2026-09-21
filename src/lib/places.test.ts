import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { placePath, placePaths, placeTree, slugify, stationPlace } from './places'
import type { Station } from './station'

const tides = () => loadCatalogue().filter((s) => s.kind === 'tide')

describe('slugify', () => {
  it('keeps an accented name legible rather than punching a hole in it', () => {
    // NFD before the filter, so "ç" decomposes and the cedilla falls to the
    // same rule as the spaces. Without it the segment reads "cura-ao".
    expect(slugify('Curaçao')).toBe('curacao')
    expect(slugify('Côte d’Ivoire')).toBe('cote-d-ivoire')
    expect(slugify('United States')).toBe('united-states')
  })
})

describe('placeTree', () => {
  const rows = tides()
  const tree = placeTree(rows)

  it('gives every station exactly one page to be found on', () => {
    // The contract of the whole split. A station on no page is reachable only
    // from the sitemap, which is the orphaning #27 existed to fix — and the
    // failure a split introduces if a filter and the tree disagree by one row.
    const paths = new Set(placePaths('tide', tree))
    const homeless: string[] = []
    for (const s of rows) {
      const at = stationPlace(tree, s)
      if (!at || !paths.has(placePath('tide', at.country.slug, at.state?.slug))) homeless.push(s.id)
    }
    expect(homeless.slice(0, 5)).toEqual([])
  })

  it('counts a country as everything under it, subdivisions included', () => {
    expect(tree.reduce((n, c) => n + c.count, 0)).toBe(rows.length)
    for (const c of tree.filter((c) => c.states.length)) {
      const claimed = c.states.reduce((n, s) => n + s.count, 0)
      expect(claimed, `${c.name}'s subdivisions claim more than it holds`).toBeLessThanOrEqual(c.count)
    }
  })

  it('splits only a country too big for one page', () => {
    // The United States is the only one over the line, and Japan — the next
    // country down — is a fifteenth its size. A second country appearing here
    // means the threshold moved or the corpus did; both are worth a look.
    expect(tree.filter((c) => c.states.length).map((c) => c.name)).toEqual(['United States'])
  })

  it('leaves no page carrying the whole corpus', () => {
    // The regression #33 reports: 4,792 station links on one page, 150 KB
    // gzipped. Every page is a country or a subdivision of one, so the biggest
    // bucket bounds the whole browse index.
    const biggest = Math.max(
      ...tree.map((c) =>
        c.states.length ? Math.max(...c.states.map((s) => s.count)) : c.count,
      ),
    )
    expect(biggest).toBeLessThan(1000)
  })

  it('mints one path per page, and no two pages at one path', () => {
    const paths = placePaths('tide', tree)
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toContain(placePath('tide', 'japan'))
    expect(paths).toContain(placePath('tide', 'united-states', 'wa'))
  })

  it('keeps a split country holding the stations its subdivisions do not claim', () => {
    // 49 US rows carry no subdivision code the catalogue trusts. They belong on
    // the country page; dropping them is the orphaning above, and inventing a
    // subdivision for them is worse.
    const us = tree.find((c) => c.name === 'United States')!
    const onCountry = rows.filter((s) => stationPlace(tree, s)?.country === us && !stationPlace(tree, s)?.state)
    expect(onCountry.length).toBeGreaterThan(0)
    expect(onCountry.every((s) => !s.state || !us.states.some((t) => t.slug === slugify(s.state!)))).toBe(true)
  })
})

describe('placeTree with no place data', () => {
  it('still gives every station a page', () => {
    const nowhere = [
      { id: 'a', kind: 'tide', slug: 'a', name: 'A' },
      { id: 'b', kind: 'tide', slug: 'b', name: 'B' },
    ] as unknown as Station[]
    const tree = placeTree(nowhere)
    expect(tree).toHaveLength(1)
    expect(tree[0]!.name).toBe('Elsewhere')
    expect(tree[0]!.count).toBe(2)
    expect(tree[0]!.states).toEqual([])
  })
})
