import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { placePath, placePaths, placeTree, slugify, stationPlace } from './places'
import type { Station } from './station'

const tides = () => loadCatalogue().filter((s) => s.kind === 'tide')

describe('slugify', () => {
  it('keeps an accented name legible rather than punching a hole in it', () => {
    // NFD splits an accented letter, and the combining mark is dropped rather
    // than filtered with the spaces — it sits between two letters, so making it
    // a separator gives "curac-ao".
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

  it('splits the countries the database gives subdivision codes, and no others', () => {
    // `region_code` is ISO 3166-2 and the database publishes it for the United
    // States and Canada only — 71% of its stations, no third country. A name
    // appearing here means that coverage grew, which is worth knowing: the
    // page count grows with it.
    expect(tree.filter((c) => c.states.length).map((c) => c.name)).toEqual([
      'Canada',
      'United States',
    ])
  })

  it('gives British Columbia a page of its own', () => {
    // Home water, and the reason the subdivision split is not US-only: the
    // provider rows here carry GeoNames numerics ("02"), so before the
    // database resolved them every Canadian station sat on one country page.
    const bc = tree.find((c) => c.name === 'Canada')!.states.find((s) => s.name === 'BC')
    expect(bc?.count).toBeGreaterThan(20)
    expect(bc?.slug).toBe('bc')
  })

  it('keeps a subdivision too small to be worth a page on its country page', () => {
    // Nunavut holds one station. A page carrying a single link is the
    // thin-content problem the corpus already answers for, and that station is
    // easier to find among Canada's than alone under a heading.
    const canada = tree.find((c) => c.name === 'Canada')!
    expect(canada.states.map((s) => s.name)).not.toContain('NU')
    const nunavut = rows.filter((s) => s.country === 'Canada' && s.state === 'NU')
    expect(nunavut.length).toBeGreaterThan(0)
    for (const s of nunavut) expect(stationPlace(tree, s)?.state).toBeUndefined()
  })

  it('leaves no page carrying the whole corpus', () => {
    // The regression #33 reports: 4,792 station links on one page, 150 KB
    // gzipped. A split country's own page keeps the stations its subdivisions
    // do not claim, so it is counted here too rather than assumed empty.
    const biggest = Math.max(
      ...tree.flatMap((c) => [
        c.count - c.states.reduce((n, s) => n + s.count, 0),
        ...c.states.map((s) => s.count),
      ]),
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
    // Two kinds of station land here: the 49 US rows with no subdivision at
    // all, and the ones whose subdivision was too small to earn a page. Both
    // belong on the country page — dropping them is the orphaning above, and
    // inventing a subdivision for the first kind is worse.
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
