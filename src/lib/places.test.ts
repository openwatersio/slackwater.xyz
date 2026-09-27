import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { kindRoot, parentPath, placeTree } from './places'
import type { Kind, Station } from './station'

const ofKind = (kind: Kind) => loadCatalogue().filter((s) => s.kind === kind)

describe('placeTree', () => {
  for (const kind of ['tide', 'current'] as Kind[]) {
    const rows = ofKind(kind)
    const tree = placeTree(rows)

    it(`gives every ${kind} station a page to be found on`, () => {
      // A station on no page is reachable only from the sitemap, which is the
      // orphaning #27 existed to fix.
      const homeless = rows.filter((s) => !tree.has(parentPath(s.path)))
      expect(homeless.slice(0, 5).map((s) => s.path)).toEqual([])
    })

    it(`makes every prefix of a ${kind} path a page, all the way up`, () => {
      // The breadcrumb links each one, and a reader trims a URL by hand.
      for (const p of tree.values()) expect(p.up === kindRoot(kind) || tree.has(p.up), p.path).toBe(true)
    })

    it(`counts a ${kind} country as everything under it`, () => {
      const countries = [...tree.values()].filter((p) => p.up === kindRoot(kind))
      expect(countries.reduce((n, c) => n + c.count, 0)).toBe(rows.length)
    })
  }

  const tree = placeTree(ofKind('tide'))

  it('names a country from its code and a subdivision by its code under it', () => {
    expect(tree.get('/tides/us/')).toMatchObject({ name: 'United States', title: 'United States', up: '/tides/' })
    expect(tree.get('/tides/us/pa/')).toMatchObject({ name: 'PA', title: 'PA, United States', up: '/tides/us/' })
    expect(tree.get('/tides/ca/bc/')?.title).toBe('BC, Canada')
  })

  it('files Bridesburg under Pennsylvania, where the database puts it', () => {
    const bridesburg = ofKind('tide').find((s) => s.slug === 'bridesburg')
    expect(bridesburg?.path).toBe('/tides/us/pa/bridesburg/')
  })

  it('gives a country its continent, and a subdivision none', () => {
    expect(tree.get('/tides/jp/')?.continent).toBeTruthy()
    expect(tree.get('/tides/us/pa/')?.continent).toBeUndefined()
  })

  it('builds a tree from paths alone', () => {
    const stations = [
      { kind: 'tide', path: '/tides/us/wa/seattle/', continent: 'Americas' },
      { kind: 'tide', path: '/tides/us/wa/tacoma/' },
      { kind: 'tide', path: '/tides/jp/kushiro/', continent: 'Asia' },
    ] as Station[]
    const small = placeTree(stations)
    expect([...small.keys()].sort()).toEqual(['/tides/jp/', '/tides/us/', '/tides/us/wa/'])
    expect(small.get('/tides/us/')).toMatchObject({ count: 2, continent: 'Americas' })
    expect(small.get('/tides/us/wa/')?.count).toBe(2)
  })
})
