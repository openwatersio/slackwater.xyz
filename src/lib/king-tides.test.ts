import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { DESCRIPTION_LIMIT } from './copy'
import { KING_TIDE_PATHS, KING_TIDE_REGIONS, type KingTideRegion } from './king-tide-regions'
import { readFileSync } from 'node:fs'
import { AGENT_VIEW } from './agent-mode'
import { dateRange, dayRange, kingTideHub, kingTideRegionPage, noaaHighs, published, rankHighs, savedSeason, seasonOf } from './king-tides'
import type { BundledStation } from './station'

const LUNAR_DAY = 24.8412 * 3_600_000
const DAY = 86_400_000
const byPath = new Map(loadCatalogue().map((s) => [s.path, s]))
const get = (path: string) => byPath.get(path) as BundledStation
const region = (slug: string) => KING_TIDE_REGIONS.find((r) => r.slug === slug)!
// Cases that pin dates name their own season, so publishing another can't move them.
const only = (slug: string, ...seasons: number[]): KingTideRegion => ({ ...region(slug), seasons })
const tides = (slug: string, path: string, year = 2026) => published(only(slug, year), path, get(path).timezone)[0].tides

const featured = KING_TIDE_REGIONS.flatMap((r) => r.stations.map(([path]) => [r.slug, path] as const))
const seasons = KING_TIDE_REGIONS.flatMap((r) => r.stations.flatMap(([path]) => r.seasons.map((year) => [r.slug, path, year] as const)))

describe('king tide regions', () => {
  it.each(KING_TIDE_REGIONS.map((r) => [r.slug, r] as const))('%s lists at least one season', (_, r) => {
    expect(r.seasons.length).toBeGreaterThan(0)
  })

  it.each(featured)('%s: %s links to a station page in its state directory', (slug, path) => {
    expect(get(path)?.source).toBe('bundled')
    expect(path.slice(0, path.slice(0, -1).lastIndexOf('/') + 1)).toBe(region(slug).directory)
  })
})

// The saved predictions are what the pages print, so a cut-short or gappy season would print wrong dates.
describe("NOAA's saved predictions", () => {
  it.each(seasons)('%s: %s in %i cover the season, padded, without gaps', (slug, path, year) => {
    const highs = noaaHighs(path, year)
    const season = seasonOf(region(slug), year, get(path).timezone)
    expect(highs[0].time).toBeLessThan(+season.from - 10 * DAY)
    expect(highs.at(-1)!.time).toBeGreaterThan(+season.to + 10 * DAY)
    for (let i = 1; i < highs.length; i++) {
      expect(highs[i].time - highs[i - 1].time).toBeGreaterThan(0)
      expect(highs[i].time - highs[i - 1].time).toBeLessThan(1.5 * LUNAR_DAY)
    }
  })

  it.each(seasons)('%s: %s in %i lists separate spring tides, never overlapping windows', (slug, path, year) => {
    const listed = tides(slug, path, year)
    // Five tidal days touch five calendar dates, or six when a high crosses midnight, as the page says.
    for (const e of listed) expect([4, 5], e.day).toContain((Date.parse(e.last) - Date.parse(e.first)) / DAY)
    for (let i = 1; i < listed.length; i++) {
      expect(listed[i].time - listed[i - 1].time, listed[i].day).toBeGreaterThan(10 * DAY)
      expect(listed[i].first > listed[i - 1].last, listed[i].day).toBe(true)
    }
  })

  it.each(seasons)('%s: %s in %i came from the station the page links to', (_, path, year) => {
    expect(savedSeason(path, year).station).toBe(get(path).id)
  })

  it.each(seasons)('%s: %s in %i keeps the highest nights either side of a peak inside the window', (slug, path, year) => {
    const highs = noaaHighs(path, year)
    const { timezone } = get(path)
    for (const e of tides(slug, path, year)) {
      for (const step of [-1, 1]) {
        const top = highs
          .filter((h) => Math.abs(h.time - e.time - step * LUNAR_DAY) < LUNAR_DAY / 2)
          .reduce((a, b) => (b.level > a.level ? b : a))
        const day = new Date(top.time).toLocaleDateString('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
        expect(day >= e.first && day <= e.last, `${day} outside ${e.first} to ${e.last}`).toBe(true)
      }
    }
  })
})

describe('ranking NOAA’s predictions', () => {
  it('matches the days Washington Sea Grant publishes for Seattle', () => {
    expect(tides('washington', '/tides/us/wa/seattle/').map((e) => [e.first, e.last])).toEqual([
      ['2026-11-25', '2026-11-29'],
      ['2026-12-25', '2026-12-29'],
      ['2027-01-23', '2027-01-27'],
    ])
  })

  it('matches the days published for the Oregon coast', () => {
    expect(tides('oregon', '/tides/us/or/southbeach/').map((e) => [e.first, e.last])).toEqual([
      ['2026-11-23', '2026-11-27'],
      ['2026-12-22', '2026-12-26'],
      ['2027-01-20', '2027-01-24'],
    ])
  })

  it("peaks inside the California Coastal Commission's dates", () => {
    // November 24–26, December 23–25 and January 21–22.
    const peaks = tides('california', '/tides/us/ca/san-francisco-golden-gate/').map((e) => e.day)
    expect(peaks).toEqual(['2026-11-25', '2026-12-24', '2027-01-21'])
  })
})

describe('rankHighs', () => {
  const season = { label: '2026', from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-03-31T00:00:00Z') }
  const series = (start: string, levels: number[]) => levels.map((level, i) => ({ time: Date.parse(start) + i * LUNAR_DAY, level }))
  const rank = (start: string, levels: number[]) => rankHighs(series(start, levels), 'UTC', season, 2)

  it('takes the five highest neighbouring tidal days', () => {
    const [tide] = rank('2026-03-10T06:00:00Z', [1, 2, 3, 7, 9, 8, 6, 2, 1])
    expect([tide.first, tide.day, tide.last]).toEqual(['2026-03-12', '2026-03-14', '2026-03-16'])
  })

  it('takes the first of two equal peaks', () => {
    expect(rank('2026-03-10T06:00:00Z', [1, 2, 3, 9, 9, 3, 2, 1]).map((e) => e.day)).toEqual(['2026-03-13'])
  })

  it('ignores a rise cut off by the season, which peaks outside it', () => {
    expect(rank('2026-03-27T06:00:00Z', [1, 2, 3, 4, 5, 6, 7, 6, 5])).toEqual([])
  })
})

describe('seasonOf', () => {
  it('runs a winter season from local midnight on November 1 to March 1', () => {
    expect(seasonOf(region('washington'), 2026, 'America/Los_Angeles')).toEqual({
      label: '2026–27',
      from: new Date('2026-11-01T07:00:00Z'),
      to: new Date('2027-03-01T08:00:00Z'),
    })
  })

  it('names a season inside one year by that year', () => {
    expect(seasonOf(region('florida'), 2027, 'America/New_York').label).toBe('2027')
  })
})

describe('date ranges', () => {
  it('formats across a month and a year', () => {
    expect(dayRange('2026-09-30', '2026-10-04')).toBe('September 30–October 4')
    expect(dateRange('2026-11-25', '2026-11-29')).toBe('November 25–29, 2026')
    expect(dateRange('2026-12-30', '2027-01-03')).toBe('December 30, 2026–January 3, 2027')
  })
})

describe('pages', () => {
  const pages = [kingTideHub(get), ...KING_TIDE_REGIONS.map((r) => kingTideRegionPage(r, get))]

  it("answers the search in the title and first paragraph, with NOAA's highest tide", () => {
    const page = kingTideRegionPage(only('washington', 2026), get)
    expect(page.title).toBe('Washington king tides 2026–27: dates, times and heights')
    const lede = page.markdown.split('\n\n')[1]
    expect(lede).toContain('At Seattle, the 2026–27 king tides are **November 25–29, December 25–29, and January 23–27**')
    // NOAA: 13.092 ft at 15:16 UTC on January 25, above December 26's 13.006 ft.
    expect(lede).toContain('13.1 ft at 7:16am on Monday, January 25, 2027')
  })

  it('lists every published season together, and quotes the highest of them in the description', () => {
    const page = kingTideRegionPage(only('florida', 2026, 2027), get)
    expect(page.title).toContain('Florida king tides 2026 and 2027')
    const [, first, second] = page.markdown.split('\n\n')
    expect(first).toContain('the 2026 king tides')
    expect(second).toContain('the 2027 king tides')
    const top = [2026, 2027].flatMap((year) => tides('florida', '/tides/us/fl/virginia-key/', year)).reduce((a, b) => (b.level > a.level ? b : a))
    expect(page.description).toContain(new Date(`${top.day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }))
  })

  it('names the years of every season in the hub title', () => {
    expect(kingTideHub(get, [only('washington', 2026), only('florida', 2026, 2027)]).title).toContain('King tides 2026–27:')
    expect(kingTideHub(get, [only('florida', 2027)]).title).toContain('King tides 2027:')
  })

  it.each(pages)('$path says nothing that depends on the day it is read', ({ markdown, description }) => {
    expect(`${description}\n${markdown}`).not.toMatch(/\b(next|current|now|today|upcoming|passed|as of|has ended)\b/i)
  })

  it.each(pages)('$path has a description short enough to show in a result', ({ description }) => {
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT)
  })

  it.each(pages)('$path credits NOAA without presenting the dates as its own', ({ markdown }) => {
    expect(markdown).toContain('Tide predictions from the [NOAA Center for Operational Oceanographic Products and Services]')
    expect(markdown).toContain('Slackwater chose the dates from them; NOAA did not.')
  })

  it('names every state where agents read about the pages', () => {
    const llms = readFileSync('public/llms.txt', 'utf8').split('\n').find((line) => line.includes('/king-tides/'))!
    const capability = AGENT_VIEW.capabilities.find((line) => line.includes('/king-tides/'))!
    for (const r of KING_TIDE_REGIONS) {
      expect(llms).toContain(r.name)
      expect(capability).toContain(r.name)
    }
  })

  it('links every state from the hub', () => {
    for (const path of KING_TIDE_PATHS.slice(1)) expect(kingTideHub(get).markdown).toContain(`](${path})`)
  })
})
