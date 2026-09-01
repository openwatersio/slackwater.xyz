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
  region?: string
}

/** Constituents ship with the page; the curve is synthesised at build time. */
export interface BundledStation extends StationIdentity {
  source: 'bundled'
  constituents: Constituent[]
  /** Datum or mean-flow offset applied to every prediction. */
  offset?: number
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
}

/**
 * A union rather than a type with optional constituents, deliberately.
 * `predictorFor` reads `station.constituents` unguarded, so an optional field
 * would type-check and then throw during prerender across every CHS page.
 * Prediction narrows to `BundledStation`; a stub cannot be passed to it.
 */
export type Station = BundledStation | ChsStation
