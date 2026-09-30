import type { Kind, Station } from './station'

/**
 * The heading for stations whose water names no place. Read by
 * `StationIndex`, which groups a page's stations by the water they sit in.
 */
export const UNPLACED = 'Elsewhere'

/** One page of the browse hierarchy above the stations: a country, or a subdivision of one. */
export interface Place {
  /** `/tides/us/`, `/tides/us/pa/`. */
  path: string
  /** The page one level up: the kind's index for a country, the country for a subdivision. */
  up: string
  /** The name in a link or a breadcrumb: "United States", "PA". */
  name: string
  /** The page heading. A subdivision code alone is not a place a reader can put on a map. */
  title: string
  /** Stations under this place, including any on its child pages. */
  count: number
  /** Countries only; subdivisions are already under their country. */
  continent?: string
}

const countries = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' })

/** The worldwide index a kind's places and stations hang off. */
export const kindRoot = (kind: Kind) => `/${kind === 'tide' ? 'tides' : 'currents'}/`

/** The page a station or place sits on: its path with the last segment dropped. */
export const parentPath = (path: string) => path.replace(/[^/]+\/$/, '')

/**
 * The nearest page above `path` that exists.
 *
 * Where a station the site withholds sends a reader. The walk skips a place
 * with no page rather than stopping at it, because a withheld station can be
 * the only one the database placed in its subdivision — 53 are — and stopping
 * would send a reader from an Alpena bookmark to the worldwide index when the
 * United States page is right there. `crumbs` stops at the first gap and has
 * to: a breadcrumb chain that skips a level is a lie about the hierarchy.
 *
 * The kind's index is the floor, and it always exists.
 */
export function nearestPlace(tree: Map<string, Place>, kind: Kind, path: string): string {
  const root = kindRoot(kind)
  for (let up = parentPath(path); up.length > root.length; up = parentPath(up)) if (tree.has(up)) return up
  return root
}

/**
 * Every place page one kind's stations imply, by path.
 *
 * Read from the paths the database publishes rather than from a station's
 * name fields, so the browse hierarchy is the URL hierarchy: every prefix of
 * a station's path is a page here, and nothing else is. A country is its ISO
 * code (`/tides/us/`), a subdivision its ISO 3166-2 code under that
 * (`/tides/us/pa/`), and a station the database places in no subdivision sits
 * on its country page.
 */
export function placeTree(stations: Station[]): Map<string, Place> {
  const tree = new Map<string, Place>()
  for (const s of stations) {
    // `/tides/` splits into three parts; anything longer is a place under it.
    for (let path = parentPath(s.path); path.split('/').length > 3; path = parentPath(path)) {
      let place = tree.get(path)
      if (!place) {
        const [, country, sub] = path.split('/').filter(Boolean)
        const countryName = countries.of(country.toUpperCase()) ?? country.toUpperCase()
        place = sub
          ? { path, up: parentPath(path), name: sub.toUpperCase(), title: `${sub.toUpperCase()}, ${countryName}`, count: 0 }
          : { path, up: parentPath(path), name: countryName, title: countryName, count: 0 }
        tree.set(path, place)
      }
      place.count++
      if (path.split('/').length === 4 && !place.continent && s.continent) place.continent = s.continent
    }
  }
  return tree
}
