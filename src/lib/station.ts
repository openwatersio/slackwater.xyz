/** One station's identity, and — for a bundled station — everything needed to predict it. */
export type Kind = 'tide' | 'current'

export interface Constituent {
  name: string
  amplitude: number
  phase: number
}

interface StationIdentity {
  id: string
  kind: Kind
  slug: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  /** The water this station sits in — "Hudson River", "Boundary Pass". */
  region?: string
  /**
   * The jurisdiction it sits in, spelled out: "Hokkaido", "British Columbia",
   * "ME". Read only to head a group on a browse page whose own title does not
   * already name it; `region` is what a station page says.
   */
  area?: string
  /** The country the station sits in, as its provider names it. */
  country?: string
  /**
   * The continent that country sits on, as the tide database names it —
   * "Americas", "Oceania", and "Atlantic Ocean" for the one station that is
   * on no continent at all. Carried only to group the country list on the
   * browse index; nothing about a station reads it.
   */
  continent?: string
  /**
   * The first-level subdivision code as `@slackwater/database` publishes it —
   * `WA`, `BC`. Only set where the provider publishes a code a reader can
   * place: Canadian rows carry GeoNames numerics ("02") and get none.
   * `region` stays the curated water-body context, which is a different thing.
   */
  state?: string
}

/**
 * The single place a station URL is built, so the planned move to a geographic
 * hierarchy (`/tides/us/wa/seattle/`) is one function plus a redirect table
 * rather than a hunt through every route, component and sitemap.
 */
export function stationPath(kind: Kind, slug: string): string {
  return `/${kind === 'tide' ? 'tides' : 'currents'}/${slug}/`
}

/** Constituents ship with the page; the curve is synthesised at build time. */
export interface BundledStation extends StationIdentity {
  source: 'bundled'
  constituents: Constituent[]
  /** Datum or mean-flow offset applied to every prediction. */
  offset?: number
  /**
   * Tides only: the datum those heights are quoted against — "MLLW", "LAT",
   * "LLWLT" and five others across the corpus. Carried so the page can name it:
   * a height with no datum on it is a number, not a depth.
   */
  chartDatum?: string
  /** Currents only: the axis the signed velocity is measured along. */
  floodDirection?: number
  ebbDirection?: number
}

/**
 * Identity only. CHS publishes no constituents we may re-serve, so this
 * station has no curve until a visitor asks DFO for one themselves.
 */
export interface ChsStation extends StationIdentity {
  source: 'chs'
  /**
   * True where the station has no provider station of its own and its water is
   * derived from a reference port plus a fixed lag. There is nothing to fetch
   * for one of these, so its page offers no curve — see `ChsGate`.
   */
  derived?: true
}

/**
 * A union rather than a type with optional constituents, deliberately.
 * `predictorFor` reads `station.constituents` unguarded, so an optional field
 * would type-check and then throw during prerender across every CHS page.
 * Prediction narrows to `BundledStation`; a stub cannot be passed to it.
 */
export type Station = BundledStation | ChsStation
