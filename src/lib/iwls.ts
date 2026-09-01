/**
 * DFO's own published predictions, fetched by the visitor's browser.
 *
 * CLIENT CODE. It must never import the catalogue, the registry, or anything
 * that pulls them — `bundle-size.test.ts` guards that boundary and this module
 * is the one piece of station code that deliberately lives on the far side of
 * it.
 *
 * THE POSTURE, which is the whole reason this file has the shape it has: CHS
 * predictions are fetched by each user under DFO's own terms and never
 * re-served. So every request here is a plain browser `fetch()`, made from the
 * reader's own browser once their page has loaded. Nothing is proxied through
 * the Worker — the moment we fetch, we are the fetcher and the posture breaks
 * — nothing is prerendered, and nothing is stored by us. Reaching for a CORS
 * proxy is the reflex to resist; IWLS answers cross-origin with
 * `access-control-allow-origin: *` and needs no help.
 *
 * `fetcher` is how the caller passes an `AbortSignal` (and how the test
 * replays a recorded day). A reader who cancels must actually stop the
 * request, not just stop seeing it.
 */
import { FEET_PER_METRE } from './format'
import { distanceNm } from './nearby'
import type { EventKind, Sample, StationEvent } from './predict'

const RAD = Math.PI / 180

const KM_PER_NM = 1.852

/**
 * How far a curated position may sit from the provider's own, in kilometres.
 *
 * The app's tolerance, kept because it is the one the corpus was measured
 * against: every gate resolves inside 0.17 km, so this has two orders of
 * magnitude of headroom on a real match while still refusing a derived gate
 * like Malibu Rapids, whose nearest current station is 47 km down another
 * inlet.
 */
export const TOLERANCE_KM = 3

/** The fields of an IWLS `/stations` record this module reads. */
export interface IwlsStation {
  id: string
  latitude: number
  longitude: number
  officialName: string
}

/**
 * The provider's station for a curated position, or nothing.
 *
 * Resolution by position is the posture, not an optimisation: the IWLS station
 * id is provider-minted, so it is never bundled and is looked up fresh from
 * `/stations` each time. Past the tolerance this returns undefined rather than
 * the nearest candidate — a station 47 km away has a real curve for real
 * water, and drawing it under this page's name is the worst failure available
 * here.
 */
export function nearestStation(
  stations: IwlsStation[],
  latitude: number,
  longitude: number,
): IwlsStation | undefined {
  let best: IwlsStation | undefined
  let bestKm = Infinity
  for (const s of stations) {
    const km = distanceNm({ latitude, longitude }, s) * KM_PER_NM
    if (km < bestKm) {
      bestKm = km
      best = s
    }
  }
  return bestKm <= TOLERANCE_KM ? best : undefined
}

/** One point of a time series: `{ eventDate, value }` is IWLS's shape everywhere. */
export interface IwlsPoint {
  eventDate: string
  value: number
}

/** A point of `wcp1-events`, which adds the qualifier naming what the point is. */
export interface IwlsEvent extends IwlsPoint {
  qualifier: string
}

/**
 * DFO's three current qualifiers, which land 1:1 on the kinds this site
 * already has. Anything else is dropped rather than guessed at.
 */
const KIND: Record<string, EventKind> = {
  SLACK: 'slack',
  EXTREMA_FLOOD: 'flood',
  EXTREMA_EBB: 'ebb',
}

/**
 * Signed knots, from an unsigned magnitude and a direction.
 *
 * `wcsp1` is a magnitude — it never goes negative, and it is the number DFO
 * prints in the tables. The sign comes from `wcdp1`: which of the station's
 * two published axes the water is setting along.
 *
 * SIGN ONLY, not a full cosine projection. The axes are not reliably
 * antiparallel — Dodd Narrows floods at 355 and ebbs at 155, twenty degrees
 * short of a reciprocal, and so do Dent Rapids and Great Bras d'Or —  so
 * `speed * cos(dir - flood)` scales the ebb down by that angle and reports
 * -6.61 kn where DFO publishes -7.037 for the same instant. Six percent, on
 * the number a mariner reads. Taking only the sign keeps DFO's magnitude
 * exactly, which is the point: this page draws DFO's published numbers rather
 * than a model of them.
 *
 * The two rules disagree on one sample a day at Dodd — the slack instant
 * itself, at 0.3 kn, where the direction is swinging between axes and the
 * value is too small to see. Slack times come from `wcp1-events` regardless.
 */
export function signedSamples(
  speeds: IwlsPoint[],
  directions: IwlsPoint[],
  floodDirection: number,
): Sample[] {
  // Joined on the timestamp rather than by index: the two series are requested
  // over one window at one resolution and do come back aligned, but a silent
  // off-by-one between them would invert the sign on every sample it shifted.
  const dir = new Map(directions.map((d) => [d.eventDate, d.value]))
  const out: Sample[] = []
  for (const s of speeds) {
    const d = dir.get(s.eventDate)
    if (d === undefined) continue
    out.push({
      time: new Date(s.eventDate),
      level: s.value * Math.sign(Math.cos((d - floodDirection) * RAD)),
    })
  }
  return out
}

/**
 * The slacks and maxima DFO publishes, rather than ones we derived.
 *
 * This is the better data and the reason the derived path is bypassed rather
 * than duplicated for a CHS gate: `findEvents` interpolates slack from a sign
 * change between samples, and DFO states the slack time outright.
 *
 * `value` is unsigned here exactly as it is in `wcsp1` — max ebb at Dodd
 * Narrows is published as +7.037 with `EXTREMA_EBB` beside it — so the sign
 * comes from the qualifier. Carried through as published, every ebb peak would
 * draw above the datum line.
 *
 * GOTCHA: never send `resolution` with this series. `wcp1-events` answers 200
 * either way, and `resolution=FIFTEEN_MINUTES` quietly returns one event for
 * the day instead of eight.
 */
export function gateEvents(raw: IwlsEvent[]): StationEvent[] {
  return raw
    .flatMap((e) => {
      const kind = KIND[e.qualifier]
      if (!kind) return []
      return [{
        kind,
        time: new Date(e.eventDate),
        // Exactly 0 for slack, per `StationEvent` — DFO already publishes 0.0,
        // but `-0` is a value `Object.is` and a "0.0" label both notice.
        level: kind === 'slack' ? 0 : kind === 'ebb' ? -e.value : e.value,
      }]
    })
    .sort((a, b) => a.time.getTime() - b.time.getTime())
}

const BASE = 'https://api-iwls.dfo-mpo.gc.ca/api/v1'

/**
 * One gate's day, fetched from DFO by the reader's own browser.
 *
 * Five requests, in series rather than in parallel. IWLS documents caps of 3
 * requests a second and 30 a minute, and firing the last four at once sits
 * exactly on the first of them for no gain a reader would notice — the whole
 * exchange is about 57 KB.
 *
 * `/stations` is filtered to the stations serving `wcsp1`, which is 31 KB and
 * thirty records rather than the 832 KB of the unfiltered list. The filter is
 * a series code — the same one the data request has to name anyway — and not a
 * provider-minted station identifier, so nothing about the omission changes.
 *
 * `fetcher` is injected so the test can replay a recorded day; production
 * passes nothing and gets the browser's own `fetch`.
 */
export async function fetchGateCurrent(
  station: { latitude: number; longitude: number },
  start: Date,
  hours: number,
  fetcher: typeof fetch = fetch,
): Promise<{ samples: Sample[]; events: StationEvent[] }> {
  const get = async (url: string) => {
    const res = await fetcher(url)
    if (!res.ok) throw new Error(`The Canadian Hydrographic Service returned ${res.status}.`)
    return res.json()
  }

  const stations: IwlsStation[] = await get(`${BASE}/stations?time-series-code=wcsp1`)
  const match = nearestStation(stations, station.latitude, station.longitude)
  if (!match) {
    throw new Error(
      'There is no Canadian Hydrographic Service current station at this gate, ' +
        'so there is nothing to show here.',
    )
  }

  const { floodDirection } = await get(`${BASE}/stations/${match.id}/metadata`)

  const from = start.toISOString()
  const to = new Date(start.getTime() + hours * 3600_000).toISOString()
  const series = (code: string, resolution: boolean) =>
    `${BASE}/stations/${match.id}/data?time-series-code=${code}` +
    `&from=${from}&to=${to}${resolution ? '&resolution=FIFTEEN_MINUTES' : ''}`

  // `wcsp1` is natively fifteen-minute and `wcdp1` matches it; the parameter is
  // sent anyway so the two series are guaranteed to share a grid, which is what
  // `signedSamples` joins them on. The events series must NOT carry it — see
  // `gateEvents`.
  const speeds: IwlsPoint[] = await get(series('wcsp1', true))
  const directions: IwlsPoint[] = await get(series('wcdp1', true))
  const raw: IwlsEvent[] = await get(series('wcp1-events', false))

  return {
    samples: signedSamples(speeds, directions, floodDirection),
    events: gateEvents(raw),
  }
}

/**
 * One port's day of tide heights, fetched from DFO by the reader's own browser.
 *
 * Three requests, not the gates' four: there is no flood axis to look up, so
 * `/metadata` is never asked for. `/stations` is filtered to the stations
 * serving `wlp` — 1,149 of them, 82 KB gzipped, against the gates' 3.8 KB.
 * That is the price of resolving by position instead of shipping a
 * provider-minted station id, and it is the posture rather than an oversight.
 * IWLS answers `cache-control: no-store`, so it is paid per page view; there
 * is no narrower query — `code` is the only other filter IWLS honours and it
 * takes the station number we deliberately do not carry. An unrecognised
 * parameter is IGNORED rather than rejected, so a `bbox` or `name` that looks
 * like it worked silently returns all 1,575 stations.
 *
 * FEET, not metres. DFO publishes heights in metres on chart datum; the site
 * speaks feet, and the conversion happens here, at the boundary where provider
 * data enters, exactly as the bundled corpus converts at its own. Labelling a
 * metre "ft" is wrong by 3.28x, looks entirely plausible, and has shipped here
 * once already.
 *
 * `high` and `low` come from `wlp-hilo` rather than from the extremes of the
 * fifteen-minute grid, for the same reason `gateEvents` prefers
 * `wcp1-events`: those are the numbers and the minutes DFO publishes, and the
 * grid is a sampling of them. The grid's own maximum lands up to seven
 * minutes off the published high and a centimetre under it. Same gotcha, too
 * — never send `resolution` with an event series.
 */
export async function fetchPortTides(
  station: { latitude: number; longitude: number },
  start: Date,
  hours: number,
  fetcher: typeof fetch = fetch,
): Promise<{ samples: Sample[]; high: Sample; low: Sample }> {
  const get = async (url: string) => {
    const res = await fetcher(url)
    if (!res.ok) throw new Error(`The Canadian Hydrographic Service returned ${res.status}.`)
    return res.json()
  }

  const stations: IwlsStation[] = await get(`${BASE}/stations?time-series-code=wlp`)
  const match = nearestStation(stations, station.latitude, station.longitude)
  if (!match) {
    throw new Error(
      'There is no Canadian Hydrographic Service tide station at this port, ' +
        'so there is nothing to show here.',
    )
  }

  const from = start.toISOString()
  const to = new Date(start.getTime() + hours * 3600_000).toISOString()
  const series = (code: string, resolution: boolean) =>
    `${BASE}/stations/${match.id}/data?time-series-code=${code}` +
    `&from=${from}&to=${to}${resolution ? '&resolution=FIFTEEN_MINUTES' : ''}`

  // `wlp` is ONE-MINUTE native, unlike the gates' fifteen-minute `wcsp1`:
  // without this parameter a Victoria day is 182,834 bytes instead of 12,314,
  // for a curve no reader could tell apart.
  const heights: IwlsPoint[] = await get(series('wlp', true))
  const hilo: IwlsPoint[] = await get(series('wlp-hilo', false))

  const feet = (p: IwlsPoint[]): Sample[] =>
    p.map((h) => ({ time: new Date(h.eventDate), level: h.value * FEET_PER_METRE }))
  const samples = feet(heights)
  const turns = feet(hilo)
  if (!samples.length || !turns.length) {
    throw new Error('The Canadian Hydrographic Service returned no predictions for this day.')
  }
  // The highest and the lowest of the day, because those are the two the chart
  // labels. `wlp-hilo` says only that each point is a turn — unlike
  // `wcp1-events`, it carries no qualifier naming which — but it does not need
  // to: which is the high is the one that is highest.
  return {
    samples,
    high: turns.reduce((a, b) => (b.level > a.level ? b : a)),
    low: turns.reduce((a, b) => (b.level < a.level ? b : a)),
  }
}
