import type {
  SlackwaterDataSource,
  Station as TideStation,
  CurrentStationInfo,
  StationSummary,
  CurrentStationSummary,
  StationsSearchParams,
  TidePredictionParams,
  Units,
} from '@slackwater/react'
import { FEET_PER_METRE } from './format'
import { findEvents, predictSeries, tideExtremes } from './predict'
import type { Kind, Station } from './station'

export type SourceStation =
  | { kind: 'tide'; station: Station; metadata: TideStation }
  | { kind: 'current'; station: Station; metadata: CurrentStationInfo }

export interface SourceCatalogue {
  station(request: { kind: Kind; id: string }): Promise<SourceStation>
  list(request: { kind: Kind; params: StationsSearchParams }): Promise<StationSummary[]>
}

function windowFor(params: { start?: string; end?: string }) {
  const start = params.start ? new Date(params.start) : new Date()
  const end = params.end ? new Date(params.end) : new Date(+start + 24 * 3600_000)
  const hours = (+end - +start) / 3600_000
  if (!Number.isFinite(+start) || !Number.isFinite(hours) || hours <= 0 || hours > 40 * 24)
    throw new Error('Prediction window must span more than zero and at most 40 days.')
  return { start, end, hours }
}

function predictable(item: SourceStation) {
  if (item.station.source !== 'bundled')
    throw new Error('CHS predictions must be fetched directly by the browser in the day panel.')
  return item.station
}

const inWindow = (time: Date, start: Date, end: Date) => time >= start && time <= end
const convert = (level: number, units: Units) => (units === 'feet' ? level : level / FEET_PER_METRE)

/** The catalogue supplies station inputs; every computed curve uses the site's predictor. */
export function createLocalDataSource(
  catalogue: SourceCatalogue,
  cacheKey: string,
  initial: SourceStation[] = [],
): SlackwaterDataSource {
  const records = new Map(initial.map((item) => [`${item.kind}:${item.station.id}`, Promise.resolve(item)]))
  async function lookup(kind: Kind, id: string) {
    const key = `${kind}:${id}`
    let pending = records.get(key)
    if (!pending) {
      pending = catalogue.station({ kind, id })
      records.set(key, pending)
      pending.catch(() => records.delete(key))
    }
    const item = await pending
    if (item.kind !== kind || item.station.id !== id || item.metadata.license.commercial_use !== true)
      throw new Error('Station is not available in the commercial catalogue.')
    return item
  }
  async function tide(params: TidePredictionParams) {
    let id = params.id
    let distance = 0
    if (!id && 'latitude' in params) {
      const rows = await catalogue.list({
        kind: 'tide',
        params: { latitude: params.latitude, longitude: params.longitude, maxResults: 1 },
      })
      id = rows[0]?.id
      distance = rows[0]?.distance ?? 0
    }
    if (!id) throw new Error('No tide station at this position.')
    const item = await lookup('tide', id)
    if (item.kind !== 'tide') throw new Error('Not a tide station.')
    return { ...item, distance }
  }
  async function current(id: string) {
    const item = await lookup('current', id)
    if (item.kind !== 'current') throw new Error('Not a current station.')
    return item
  }
  const list = async (kind: Kind, params: StationsSearchParams) =>
    (await catalogue.list({ kind, params })).filter((s) => s.kind === kind && s.license?.commercial_use === true)

  return {
    cacheKey,
    async getStation(id) {
      return (await tide({ id })).metadata
    },
    getStations: (params) => list('tide', params),
    async getTimeline(params) {
      const { start, end, hours } = windowFor(params)
      const item = await tide(params)
      const station = predictable(item)
      const units = params.units ?? 'meters'
      const datum =
        item.metadata.chart_datum && item.metadata.datums[item.metadata.chart_datum] !== undefined
          ? item.metadata.chart_datum
          : undefined
      return {
        units,
        datum,
        station: item.metadata,
        distance: item.distance,
        timeline: predictSeries(station, start, hours)
          .filter((p) => inWindow(p.time, start, end))
          .map((p) => ({ ...p, level: convert(p.level, units) })),
      }
    },
    async getExtremes(params) {
      const { start, end, hours } = windowFor(params)
      const item = await tide(params)
      const station = predictable(item)
      const units = params.units ?? 'meters'
      const datum =
        item.metadata.chart_datum && item.metadata.datums[item.metadata.chart_datum] !== undefined
          ? item.metadata.chart_datum
          : undefined
      return {
        units,
        datum,
        station: item.metadata,
        distance: item.distance,
        extremes: tideExtremes(station, start, hours)
          .filter((p) => inWindow(p.time, start, end))
          .map((p) => ({ ...p, level: convert(p.level, units), low: !p.high, label: p.high ? 'High' : 'Low' })),
      }
    },
    async getCurrentStation(id) {
      return (await current(id)).metadata
    },
    async getCurrentStations(params) {
      return (await list('current', params)).map((s) => {
        if (!('bins' in s)) throw new Error('Current station has no bin metadata.')
        return s as CurrentStationSummary
      })
    },
    async getCurrentTimeline(params) {
      const { start, end, hours } = windowFor(params)
      const item = await current(params.id)
      return {
        units: 'knots',
        station: item.metadata,
        timeline: predictSeries(predictable(item), start, hours)
          .filter((p) => inWindow(p.time, start, end))
          .map((p) => ({ time: p.time, speed: p.level })),
      }
    },
    async getCurrentEvents(params) {
      const { start, end, hours } = windowFor(params)
      const item = await current(params.id)
      const station = predictable(item)
      return {
        units: 'knots',
        station: item.metadata,
        events: findEvents(station, start, hours)
          .filter((p) => inWindow(p.time, start, end))
          .map((e) => ({
            time: e.time,
            speed: e.level,
            kind:
              e.kind === 'slack'
                ? ('slack' as const)
                : e.kind === 'flood'
                  ? ('maxFlood' as const)
                  : ('maxEbb' as const),
            ...(e.kind === 'slack'
              ? {}
              : { direction: e.kind === 'flood' ? station.floodDirection : station.ebbDirection }),
          })),
      }
    },
  }
}
