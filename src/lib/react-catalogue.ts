// Server-only: imported dynamically inside the catalogue RPC handlers.
import { loadStations } from '@slackwater/database'
import type {
  CurrentStationInfo,
  Station as TideStation,
  StationsSearchParams,
  StationSummary,
} from '@slackwater/react'
import { loadCatalogue } from './catalogue'
import { distanceNm } from './nearby'
import type { Kind, Station } from './station'
import type { SourceStation } from './react-source'

const db = await loadStations()
const stations = loadCatalogue().filter((s) => db.byId(s.id)?.license?.commercial_use === true)
const byId = new Map(stations.map((s) => [`${s.kind}:${s.id}`, s]))
const summaries = new Map<string, SourceStation>()

function metadata(station: Station): SourceStation {
  const key = `${station.kind}:${station.id}`
  const held = summaries.get(key)
  if (held) return held
  const r = db.byId(station.id)
  if (!r || r.license?.commercial_use !== true) throw new Error('Station is not available in the commercial catalogue.')
  const available = station.source === 'bundled'
  const summary = {
    id: station.id,
    kind: station.kind,
    name: station.name,
    latitude: station.latitude,
    longitude: station.longitude,
    timezone: station.timezone,
    region: station.region,
    country: station.country ?? '',
    continent: station.continent ?? '',
    type: r.type === 'subordinate' ? ('subordinate' as const) : ('reference' as const),
    license: r.license,
    attribution: r.attribution,
    predictions: available,
    ...(!available
      ? {
          unavailable:
            station.source === 'chs' && station.derived
              ? 'This derived gate has no CHS station to fetch.'
              : 'Today’s CHS predictions are fetched directly by your browser in the day panel.',
        }
      : {}),
  }
  const source = { id: r.source.id ?? station.id, name: r.source.name, url: r.source.url ?? '' }
  let item: SourceStation
  if (station.kind === 'tide') {
    const result: TideStation = {
      ...summary,
      kind: 'tide',
      source,
      datums: r.datums ?? {},
      harmonic_constituents: [],
      chart_datum: r.chart_datum,
      defaultDatum: r.chart_datum && r.datums?.[r.chart_datum] !== undefined ? r.chart_datum : undefined,
      disclaimers: r.disclaimers,
      ...(station.source === 'bundled' && station.tideReduction
        ? { offsets: { reference: station.tideReduction.referenceId } }
        : {}),
    }
    item = { kind: 'tide', station, metadata: result }
  } else {
    const current = station.source === 'bundled' ? station : undefined
    const suffix = station.id.split('@')[1]
    const result: CurrentStationInfo = {
      ...summary,
      kind: 'current',
      predictions: available,
      source: { ...source, published_harmonics: r.source.published_harmonics ?? false },
      license: { ...r.license, url: r.license.url ?? '' },
      disclaimers: r.disclaimers,
      bins: [{ id: station.id, ...(suffix ? { bin: Number(suffix) } : {}) }],
      current: {
        flood_direction: current?.floodDirection,
        ebb_direction: current?.ebbDirection,
        mean_flow: current?.offset,
        ...(current?.reduction ? { offsets: { reference: current.reduction.referenceId } } : {}),
      },
    }
    item = { kind: 'current', station, metadata: result }
  }
  summaries.set(key, item)
  return item
}

function validKind(kind: Kind) {
  if (kind !== 'tide' && kind !== 'current') throw new Error('Invalid station kind.')
}

export async function getReactStation({ kind, id }: { kind: Kind; id: string }): Promise<SourceStation> {
  validKind(kind)
  if (typeof id !== 'string' || id.length > 200) throw new Error('Invalid station ID.')
  const station = byId.get(`${kind}:${id}`)
  if (!station) throw new Error('Station is not available in the commercial catalogue.')
  return metadata(station)
}

export async function listReactStations({
  kind,
  params,
}: {
  kind: Kind
  params: StationsSearchParams
}): Promise<StationSummary[]> {
  validKind(kind)
  const { latitude, longitude, maxDistance, bbox } = params
  const positioned = latitude !== undefined || longitude !== undefined
  if (
    positioned &&
    (!Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude!) > 90 ||
      Math.abs(longitude!) > 180)
  )
    throw new Error('Invalid station search position.')
  const limit = params.maxResults ?? (bbox ? stations.length : 60)
  if (params.maxResults !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1000))
    throw new Error('Station result limit must be between 1 and 1000.')
  if (maxDistance !== undefined && (!Number.isFinite(maxDistance) || maxDistance < 0))
    throw new Error('Invalid distance limit.')
  if (params.query !== undefined && (typeof params.query !== 'string' || params.query.length > 200))
    throw new Error('Invalid station search query.')
  const query = params.query?.trim().toLocaleLowerCase() ?? ''
  const box = bbox?.split(',').map(Number)
  if (
    bbox !== undefined &&
    (!box ||
      box.length !== 4 ||
      box.some((v) => !Number.isFinite(v)) ||
      Math.abs(box[0]) > 180 ||
      Math.abs(box[2]) > 180 ||
      box[1] < -90 ||
      box[3] > 90 ||
      box[1] > box[3])
  )
    throw new Error('Invalid bounding box.')
  const rows = stations
    .filter((s) => {
      if (s.kind !== kind || (query && !`${s.name} ${s.region ?? ''}`.toLocaleLowerCase().includes(query))) return false
      if (!box) return true
      const [west, south, east, north] = box
      return (
        s.latitude >= south &&
        s.latitude <= north &&
        (west <= east ? s.longitude >= west && s.longitude <= east : s.longitude >= west || s.longitude <= east)
      )
    })
    .map((station) => ({
      station,
      distance: positioned ? distanceNm(station, { latitude: latitude!, longitude: longitude! }) * 1.852 : undefined,
    }))
    .filter((row) => maxDistance === undefined || (row.distance !== undefined && row.distance <= maxDistance))
    .sort((a, b) =>
      positioned
        ? a.distance! - b.distance! || a.station.id.localeCompare(b.station.id)
        : a.station.name.localeCompare(b.station.name),
    )
    .slice(0, limit)
  return rows.map(({ station, distance }) => {
    const { source: _, ...summary } = metadata(station).metadata
    // Listings carry identity, availability and credits, never prediction inputs.
    const {
      id,
      name,
      latitude,
      longitude,
      region,
      country,
      continent,
      timezone,
      type,
      kind,
      predictions,
      unavailable,
      attribution,
      license,
    } = summary
    return {
      id,
      name,
      latitude,
      longitude,
      region,
      country,
      continent,
      timezone,
      type,
      kind,
      predictions,
      unavailable,
      attribution,
      license,
      distance,
      ...('bins' in summary ? { bins: summary.bins } : {}),
    }
  })
}
