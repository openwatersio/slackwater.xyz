import { describe, expect, it } from 'vitest'
import { LISTED, placeJsonLd, stationJsonLd } from './json-ld'
import type { Station } from './station'

const base = {
  id: 'x', slug: 'deception-pass', path: '/currents/us/wa/deception-pass/', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  source: 'bundled' as const, constituents: [],
}
const CURRENT: Station = { ...base, kind: 'current' }
const TIDE: Station = { ...base, kind: 'tide', slug: 'seattle', path: '/tides/us/wa/seattle/', name: 'Seattle' }

const URL = 'https://slackwater.xyz/currents/us/wa/deception-pass/'
const TRAIL = [
  { href: '/currents/', label: 'Current stations' },
  { href: '/currents/us/', label: 'United States' },
  { href: '/currents/us/wa/', label: 'Washington' },
]

describe('stationJsonLd', () => {
  it('describes the Place with its coordinates', () => {
    const [place] = stationJsonLd(CURRENT, URL, TRAIL) as Record<string, any>[]
    expect(place['@type']).toBe('Place')
    expect(place['@context']).toBe('https://schema.org')
    expect(place.name).toBe(CURRENT.name)
    expect(place.url).toBe(URL)
    expect(place.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 48.4, longitude: -122.64 })
  })

  it('omits the address entirely when the station has neither state nor country', () => {
    // An empty PostalAddress is worse than no address: it asserts a place we
    // do not know, and Search Console flags it rather than ignoring it.
    const [place] = stationJsonLd(CURRENT, URL, TRAIL) as Record<string, any>[]
    expect(place).not.toHaveProperty('address')
  })

  it('carries the country alone when that is all we know', () => {
    const [place] = stationJsonLd({ ...TIDE, country: 'CA' }, URL, TRAIL) as Record<string, any>[]
    expect(place.address).toEqual({ '@type': 'PostalAddress', addressCountry: 'CA' })
  })

  it('carries both when both are known', () => {
    const [place] = stationJsonLd({ ...TIDE, country: 'US', state: 'WA' }, URL, TRAIL) as Record<string, any>[]
    expect(place.address).toEqual({ '@type': 'PostalAddress', addressRegion: 'WA', addressCountry: 'US' })
  })

  it('breadcrumbs home, every place above the station, then the station itself', () => {
    const [, crumbs] = stationJsonLd(CURRENT, URL, TRAIL) as Record<string, any>[]
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, 'Slackwater', 'https://slackwater.xyz/'],
      [2, 'Current stations', 'https://slackwater.xyz/currents/'],
      [3, 'United States', 'https://slackwater.xyz/currents/us/'],
      [4, 'Washington', 'https://slackwater.xyz/currents/us/wa/'],
      [5, CURRENT.name, URL],
    ])
  })
})

describe('placeJsonLd', () => {
  const PAGE = 'https://slackwater.xyz/currents/us/wa/'
  const links = Array.from({ length: LISTED + 5 }, (_, i) => ({ href: `/currents/us/wa/s${i}/`, name: `Station ${i}` }))
  const [collection, crumbs] = placeJsonLd(
    { title: 'Washington, United States', name: 'Washington', crumbs: TRAIL.slice(0, 2), links },
    PAGE,
  ) as Record<string, any>[]

  it('lists what the page links to, counting all of it while listing the first hundred', () => {
    expect(collection['@type']).toBe('CollectionPage')
    expect(collection.name).toBe('Washington, United States')
    expect(collection.mainEntity['@type']).toBe('ItemList')
    expect(collection.mainEntity.numberOfItems).toBe(LISTED + 5)
    expect(collection.mainEntity.itemListElement).toHaveLength(LISTED)
    expect(collection.mainEntity.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Station 0',
      item: 'https://slackwater.xyz/currents/us/wa/s0/',
    })
  })

  it('breadcrumbs home, the pages above, then the page by the name its stations know it by', () => {
    expect(crumbs.itemListElement.map((i: any) => [i.position, i.name, i.item])).toEqual([
      [1, 'Slackwater', 'https://slackwater.xyz/'],
      [2, 'Current stations', 'https://slackwater.xyz/currents/'],
      [3, 'United States', 'https://slackwater.xyz/currents/us/'],
      [4, 'Washington', PAGE],
    ])
  })
})
