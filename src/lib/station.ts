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
  /**
   * The station's URL, as the tide database publishes it for the route:
   * `/tides/us/pa/bridesburg/`, or `/tides/jp/kushiro/` where the database
   * vouches for no subdivision. Every link to a station is this string; the
   * site never builds one.
   */
  path: string
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
  /**
   * Tides only, and only where the database labelled the station
   * `quality.seasonal_dominant`: how many times the seasonal band exceeds the
   * largest tidal constituent.
   *
   * Present or absent is the database's verdict and is never decided here — that
   * is the point of it living upstream, so the app and this site do not describe
   * the same water two ways. The number is the site's own, and only chooses how
   * loudly a page says it: 1.008 at Annapolis, which has a real Chesapeake tide,
   * and 162 at Cobourg on Lake Ontario, which has none. See `seasonalNote`.
   */
  seasonal?: number
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
