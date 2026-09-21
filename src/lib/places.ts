import type { Kind, Station } from './station'

/**
 * A country holds its stations on one page until it reaches this many, past
 * which its subdivisions become pages of their own.
 *
 * One rule rather than a rule and an exception: the United States is the only
 * country over the line (3,164 tide stations) and the next one down is Japan
 * at 198, so anywhere between those two picks out the same country. The line
 * is drawn at what a page should carry rather than at what today's corpus
 * happens to need, because #17 and slackwater-ios#229 both grow it.
 *
 * The leaf pages this mints are allowed past it — Alaska is 559 stations,
 * about 20 KB gzipped — because a subdivision is as far as the data goes. A
 * third level would need a locality the catalogue does not carry.
 */
const SPLIT_COUNTRY_ABOVE = 500

/** A country needs this many subdivisions before splitting improves anything. */
const SPLIT_INTO_AT_LEAST = 2

export interface Place {
  /** The URL segment. */
  slug: string
  /** The heading, and the name in a breadcrumb. */
  name: string
  /** Stations under this place, including any on its child pages. */
  count: number
}

export interface CountryPlace extends Place {
  continent: string
  /** Subdivision pages, empty where the country fits on one page. */
  states: Place[]
}

/**
 * A place that is not one: no country on a station here, no region on a
 * station inside a page. Kept as a bucket rather than dropped, because a
 * station silently missing from the browse index is the orphaning that made
 * #27 necessary.
 *
 * Every station in today's corpus has a country, so the country bucket is a
 * floor and not a page anyone reaches. The region one carries real weight —
 * see `StationIndex`.
 */
export const UNPLACED = 'Elsewhere'

/**
 * A URL segment from a place name: lowercase, ASCII, hyphens.
 *
 * NFD splits an accented letter into a letter and a combining mark, and the
 * mark is dropped rather than filtered with the spaces — it sits between two
 * letters, so turning it into a separator gives "curac-ao" instead of
 * "curacao".
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Where one place's page lives; with no place, the index they hang off. */
export function placePath(kind: Kind, country?: string, state?: string): string {
  return `/stations/${[kind === 'tide' ? 'tides' : 'currents', country, state].filter(Boolean).join('/')}/`
}

const byName = (a: Place, b: Place) => a.name.localeCompare(b.name)

/**
 * Every country in one kind's corpus, and the subdivisions of any country too
 * big to sit on one page.
 *
 * Built from `country` and `state` rather than `region`: `region` is the water
 * a station sits in — "Hudson River", "Boundary Pass" — which is the right
 * heading inside a page and the wrong thing to route on, being a long tail
 * where most values name a single station. `state` is only ever a subdivision
 * code the catalogue vouched for; see `SUBDIVISION` in `catalogue.ts`.
 */
export function placeTree(stations: Station[]): CountryPlace[] {
  const byCountry = new Map<string, Station[]>()
  for (const s of stations) {
    const key = s.country ?? UNPLACED
    const list = byCountry.get(key)
    list ? list.push(s) : byCountry.set(key, [s])
  }

  const out: CountryPlace[] = []
  for (const [name, list] of byCountry) {
    const states = new Map<string, number>()
    for (const s of list) if (s.state) states.set(s.state, (states.get(s.state) ?? 0) + 1)
    const split = list.length > SPLIT_COUNTRY_ABOVE && states.size >= SPLIT_INTO_AT_LEAST
    out.push({
      slug: slugify(name),
      name,
      count: list.length,
      continent: list.find((s) => s.continent)?.continent ?? UNPLACED,
      states: split
        ? [...states].map(([code, count]) => ({ slug: slugify(code), name: code, count })).sort(byName)
        : [],
    })
  }
  return out.sort(byName)
}

/**
 * The one page a station is found on.
 *
 * The rule the browse index routes on, kept here rather than in the route so
 * that "every station is on exactly one page" is a thing a test can check
 * rather than a thing three filters happen to agree about. A station in a
 * split country with no subdivision code stays on its country page: that is
 * the 49 US rows the provider gives no state, and dropping them is the
 * orphaning the browse index exists to prevent.
 */
export function stationPlace(
  tree: CountryPlace[],
  station: Station,
): { country: CountryPlace; state?: Place } | undefined {
  const country = tree.find((c) => c.name === (station.country ?? UNPLACED))
  if (!country) return undefined
  const state = station.state
    ? country.states.find((s) => s.slug === slugify(station.state!))
    : undefined
  return state ? { country, state } : { country }
}

/** Every place page the tree implies, for the prerender list and the sitemap. */
export function placePaths(kind: Kind, tree: CountryPlace[]): string[] {
  return tree.flatMap((c) => [
    placePath(kind, c.slug),
    ...c.states.map((s) => placePath(kind, c.slug, s.slug)),
  ])
}
