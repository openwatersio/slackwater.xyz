import type { Kind, Station } from './station'

const ORIGIN = 'https://slackwater.xyz'
// The database's own section, as the OpenCPN dataset cites it: the sources carry different
// licences and attribution requirements, and that section names them.
const LICENSE = 'https://github.com/openwatersio/slackwater-database#license'

/** One station page, as `/stations.json` lists it. */
export interface IndexedStation {
  kind: Kind
  /** The station page's path, the same string the sitemaps list. */
  path: string
  name: string
  latitude: number
  longitude: number
  /** Its notice's position in `attributions`. */
  attribution: number
}

/** The document at `/stations.json`. */
export interface StationIndex {
  origin: string
  license: string
  /**
   * The notices the stations' licences ask anyone redistributing them to display, each once.
   * A handful of strings serve every station, so listing them per station would multiply the file.
   */
  attributions: string[]
  stations: IndexedStation[]
}

// Four decimal places is about 10 m, closer than any station needs to be placed.
const round = (degrees: number) => Math.round(degrees * 1e4) / 1e4

/**
 * Every station page with its position and attribution, so another site can link a place to
 * the station pages near it. Built from the catalogue the sitemaps read, so it lists the same
 * pages they do. The database's rule for redistributing a station is to display its
 * attribution, so a station without one fails the build rather than publish without it.
 */
export function buildStationIndex(stations: Station[], attributionOf: (id: string) => string): string {
  const attributions: string[] = []
  const position = new Map<string, number>()
  const noticeOf = (s: Station) => {
    const notice = attributionOf(s.id)
    if (!notice.trim()) throw new Error(`station-index: no attribution for ${s.id}`)
    let at = position.get(notice)
    if (at === undefined) {
      at = attributions.push(notice) - 1
      position.set(notice, at)
    }
    return at
  }
  const listed = stations.map((s) => ({
    kind: s.kind,
    path: s.path,
    name: s.name,
    latitude: round(s.latitude),
    longitude: round(s.longitude),
    attribution: noticeOf(s),
  }))
  const index: StationIndex = { origin: ORIGIN, license: LICENSE, attributions, stations: listed }
  return `${JSON.stringify(index)}\n`
}
