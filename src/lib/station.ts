/** One station's identity and everything needed to predict it. */
export type Kind = 'tide' | 'current'

export interface Constituent {
  name: string
  amplitude: number
  phase: number
}

export interface Station {
  id: string
  kind: Kind
  slug: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  region?: string
  constituents: Constituent[]
  /** Datum or mean-flow offset applied to every prediction. */
  offset?: number
  /** Currents only: the axis the signed velocity is measured along. */
  floodDirection?: number
  ebbDirection?: number
}
