// The king tide pages print NOAA's predicted highs, not this site's: see CONTRIBUTING.md, "King tide pages".
import noaa from '../data/noaa-king-tides.json' with { type: 'json' }
import { chartTime, dayStart, height } from './format'
import { KING_TIDE_REGIONS, KING_TIDES_PATH, kingTidePath, NOAA_DATUM, type KingTideRegion } from './king-tide-regions'
import type { BundledStation } from './station'

const HOUR = 3600_000
// Highs repeat on the lunar day, so counting civil days would skip a night high as it crosses midnight.
const LUNAR_DAY = 24.8412 * HOUR
const WINDOW_DAYS = 5
// Less than half a spring-neap cycle, so neighbouring spring tides never compete as one peak.
const PEAK_REACH_DAYS = 5

export interface Season {
  /** "2026–27", or "2026" for a season inside one year. */
  label: string
  from: Date
  to: Date
}

export interface KingTide {
  /** Station-local dates, YYYY-MM-DD. */
  first: string
  last: string
  day: string
  /** The highest high in the window, epoch milliseconds and feet above NOAA_DATUM. */
  time: number
  level: number
}

export interface KingTidePage {
  path: string
  heading: string
  title: string
  description: string
  markdown: string
}

export interface High {
  time: number
  level: number
}

type GetStation = (path: string) => BundledStation

const list = new Intl.ListFormat('en-US')

const localDay = (time: Date, timeZone: string) =>
  time.toLocaleDateString('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })

const yearSpan = (from: number, to: number) => (from === to ? String(from) : `${from}–${String(to).slice(-2)}`)

const endYear = ({ months: [from, to] }: KingTideRegion, year: number) => (to <= from ? year + 1 : year)

/** The region's season that starts in `year`. */
export function seasonOf(region: KingTideRegion, year: number, timeZone: string): Season {
  // Noon UTC is the same calendar date throughout the US.
  const boundary = (y: number, month: number) => dayStart(new Date(Date.UTC(y, month - 1, 1, 12)), timeZone)
  const [from, to] = region.months
  const end = endYear(region, year)
  return { label: yearSpan(year, end), from: boundary(year, from), to: boundary(end, to) }
}

export function eventSeason(region: KingTideRegion, at: Date, timeZone: string): number | undefined {
  return region.seasons.find((year) => {
    const season = seasonOf(region, year, timeZone)
    return at >= season.from && at < season.to
  })
}

export interface SavedSeason {
  /** The NOAA station the highs came from, as the database names it. */
  station: string
  datum: string
  highs: number[]
}

/** What tools/fetch-noaa-king-tides.mjs saved for one station's season. */
export function savedSeason(path: string, year: number): SavedSeason {
  const saved = (noaa as Record<string, SavedSeason>)[`${path} ${year}`]
  if (!saved) throw new Error(`king tides: no NOAA predictions for ${path} ${year}; run tools/fetch-noaa-king-tides.mjs`)
  if (saved.datum !== NOAA_DATUM) throw new Error(`king tides: ${path} ${year} was saved on ${saved.datum}, not ${NOAA_DATUM}`)
  return saved
}

/** NOAA's predicted highs for one station's season. */
export function noaaHighs(path: string, year: number): High[] {
  const flat = savedSeason(path, year).highs
  const highs: High[] = []
  for (let i = 0; i < flat.length; i += 2) highs.push({ time: flat[i] * 60_000, level: flat[i + 1] / 1000 })
  return highs
}

/**
 * The highest spring-tide peaks among `highs`, in time order, each with the run of tidal days around it.
 *
 * Ranked on level, never range or lunar phase: the seasonal terms decide which month is highest,
 * and the local peak can trail the Moon by days.
 */
export function rankHighs(highs: High[], timeZone: string, season: Season, count: number): KingTide[] {
  const reach = (PEAK_REACH_DAYS + 0.5) * LUNAR_DAY
  return highs
    .filter(
      (peak) =>
        peak.time >= +season.from &&
        peak.time < +season.to &&
        highs.every(
          (h) =>
            h === peak ||
            Math.abs(h.time - peak.time) > reach ||
            (h.time < peak.time ? h.level < peak.level : h.level <= peak.level),
        ),
    )
    .sort((a, b) => b.level - a.level)
    .slice(0, count)
    .sort((a, b) => a.time - b.time)
    .map((peak) => {
      const around = highs.filter((h) => Math.abs(h.time - peak.time) < WINDOW_DAYS * LUNAR_DAY)
      const top = (step: number) =>
        around
          .filter((h) => Math.abs(h.time - peak.time - step * LUNAR_DAY) < LUNAR_DAY / 2)
          .reduce<High | undefined>((a, b) => (a && a.level >= b.level ? a : b), undefined)
      const run = [peak]
      let before = -1
      let after = 1
      while (run.length < WINDOW_DAYS) {
        const left = top(before)
        const right = top(after)
        if (left && (!right || left.level > right.level)) {
          run.unshift(left)
          before--
        } else if (right) {
          run.push(right)
          after++
        } else break
      }
      const day = (high: High) => localDay(new Date(high.time), timeZone)
      return { first: day(run[0]), last: day(run[run.length - 1]), day: day(peak), time: peak.time, level: peak.level }
    })
}

/** One station's king tides in each season the region publishes. */
export function published(region: KingTideRegion, path: string, timeZone: string) {
  if (!region.seasons.length) throw new Error(`king tides: ${region.slug} lists no seasons`)
  return region.seasons.map((year) => {
    const season = seasonOf(region, year, timeZone)
    const tides = rankHighs(noaaHighs(path, year), timeZone, season, region.events)
    if (tides.length !== region.events) throw new Error(`king tides: ${tides.length} events at ${path} in ${season.label}`)
    return { label: season.label, tides }
  })
}

const civil = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...options })

/** "November 25–29", "November 28–December 2". */
export function dayRange(first: string, last: string): string {
  const month = (day: string) => civil(day, { month: 'long', day: 'numeric' })
  const end = first.slice(0, 7) === last.slice(0, 7) ? String(Number(last.slice(8))) : month(last)
  return `${month(first)}–${end}`
}

/** "November 25–29, 2026", "December 30, 2026–January 3, 2027". */
export function dateRange(first: string, last: string): string {
  const year = last.slice(0, 4)
  if (first.slice(0, 4) === year) return `${dayRange(first, last)}, ${year}`
  const full = (day: string) => civil(day, { month: 'long', day: 'numeric', year: 'numeric' })
  return `${full(first)}–${full(last)}`
}

const highest = (tides: KingTide[]) => tides.reduce((a, b) => (b.level > a.level ? b : a))

type Seasons = ReturnType<typeof published>

/** A paragraph per season: every date at the station, then the season's highest tide. */
function summaries(timeZone: string, name: string, seasons: Seasons): string[] {
  return seasons.map(({ label, tides }) => {
    const top = highest(tides)
    const when = `${chartTime(new Date(top.time), timeZone)} on ${civil(top.day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`
    return `At ${name}, the ${label} king tides are **${list.format(tides.map((e) => dayRange(e.first, e.last)))}**. NOAA predicts the highest at **${height(top.level)} ft at ${when}**, measured above ${NOAA_DATUM}.`
  })
}

const regionHeading = (region: KingTideRegion, seasons: Seasons) =>
  `${region.name} king tides ${list.format(seasons.map((s) => s.label))}`

const SOURCE = 'Tide predictions from the [NOAA Center for Operational Oceanographic Products and Services](https://tidesandcurrents.noaa.gov/) (CO-OPS). Slackwater chose the dates from them; NOAA did not.'

const WHAT = `## What is a king tide?

A king tide is an everyday name for one of the highest predicted high tides of the year or season at a place. It is not a scientific term. King tides usually follow a new or full moon that falls near perigee, the Moon’s closest point to Earth, which is why they are often [perigean spring tides](https://oceanservice.noaa.gov/facts/perigean-spring-tide.html).

A perigean spring tide isn’t always a king tide. The time of year raises and lowers the sea too, and the local peak can come days after the Moon lines up, so king tide dates differ from one coast to another.`

const CAUTION = `## Predictions are not observations

These are predicted tides. Storm surge, wind, waves, rain, river flow and El Niño can push the water well above them. Stay off jetties and wave-washed rocks, watch for flooded roads, and check [National Weather Service alerts](https://www.weather.gov/alerts) before you go. Not for navigation.

[How tides work](/learn/tides/)`

export function kingTideRegionPage(region: KingTideRegion, get: GetStation): KingTidePage {
  const stations = region.stations.map(([path, name]) => {
    const { timezone } = get(path)
    return { path, name, timezone, seasons: published(region, path, timezone) }
  })
  const lead = stations[0]
  const heading = regionHeading(region, lead.seasons)

  const sections = stations.map(({ path, name, timezone, seasons }) => {
    const rows = seasons.flatMap(({ tides }) =>
      tides.map((e) => {
        const peak = `${civil(e.day, { weekday: 'short', month: 'short', day: 'numeric' })}, ${chartTime(new Date(e.time), timezone)}`
        return `| ${dateRange(e.first, e.last)} | ${peak} | ${height(e.level)} ft |`
      }),
    )
    return `## ${name} king tides

| Dates | Highest tide | Height |
| --- | --- | --- |
${rows.join('\n')}

Heights are feet above ${NOAA_DATUM}. [${name} tide chart](${path})`
  })

  const others = KING_TIDE_REGIONS.filter((r) => r.slug !== region.slug).map((r) => `[${r.name}](${kingTidePath(r)})`)

  const markdown = [
    `# ${heading}`,
    ...summaries(lead.timezone, lead.name, lead.seasons),
    `${region.when} All times are local.`,
    ...sections,
    WHAT,
    '## How these dates are chosen',
    `The heights and times are NOAA’s predictions for each station. Slackwater takes the season’s ${region.events} highest peaks from separate spring tides, and each date range covers the five tidal days of highest water around a peak. A tidal day is about 50 minutes longer than a calendar day, so a range can touch six dates. The [${region.name} tide directory](${region.directory}) has tide tables for more places.`,
    'Each station’s tide chart on this site comes from Slackwater’s own predictions, which can differ from NOAA’s by up to a few tenths of a foot.',
    ...(region.official
      ? [`Agencies draw their windows differently, so their dates can be a day or two wider or narrower. For official dates and events, see [${region.official.name}](${region.official.url}).`]
      : []),
    CAUTION,
    `King tides elsewhere: [all dates](${KING_TIDES_PATH}) · ${others.join(' · ')}`,
    SOURCE,
  ].join('\n\n')

  const top = highest(lead.seasons.flatMap((s) => s.tides))
  return {
    path: kingTidePath(region),
    heading,
    title: `${heading}: dates, times and heights`,
    description: `${heading}: dates, times and heights. ${lead.name} peaks at ${height(top.level)} ft on ${civil(top.day, { month: 'long', day: 'numeric', year: 'numeric' })}.`,
    markdown: `${markdown}\n`,
  }
}

export function kingTideHub(get: GetStation, regions: KingTideRegion[] = KING_TIDE_REGIONS): KingTidePage {
  const states = regions.map((region) => {
    const [path, name] = region.stations[0]
    const { timezone } = get(path)
    return { region, name, timezone, seasons: published(region, path, timezone) }
  })
  const first = Math.min(...regions.flatMap((r) => r.seasons))
  const last = Math.max(...regions.flatMap((r) => r.seasons.map((year) => endYear(r, year))))
  const heading = `King tides ${yearSpan(first, last)}`

  const markdown = [
    `# ${heading}`,
    'King tide dates change along the coast. These are the dates at one place in each state, and each state’s page has the dates, times and heights for more.',
    ...states.flatMap(({ region, name, timezone, seasons }) => [
      `## ${regionHeading(region, seasons)}`,
      ...summaries(timezone, name, seasons),
      `[All ${region.name} king tide dates and places](${kingTidePath(region)})`,
    ]),
    '## When is king tide season?',
    states.map(({ region }) => `- **[${region.name}](${kingTidePath(region)}):** ${region.when}`).join('\n'),
    WHAT,
    CAUTION,
    SOURCE,
  ].join('\n\n')

  return {
    path: KING_TIDES_PATH,
    heading,
    title: `${heading}: dates and times by state`,
    description: `${heading} in ${list.format(regions.map((r) => r.name))}: dates, times and heights of the highest predicted tides.`,
    markdown: `${markdown}\n`,
  }
}
