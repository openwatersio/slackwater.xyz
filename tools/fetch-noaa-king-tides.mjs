// node tools/fetch-noaa-king-tides.mjs: NOAA's predicted highs for every published king tide
// season, which the king tide pages rank and print. Run it after changing a region's seasons or stations.
import { writeFileSync } from 'node:fs'
import { loadStations } from '@slackwater/database'
import { KING_TIDE_REGIONS, NOAA_DATUM } from '../src/lib/king-tide-regions.ts'

const DAY = 86_400_000
// Wider than the ranking reaches, so a peak at either end of a season has all its neighbours.
const PAD_DAYS = 14
const TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
const FEET = /^-?\d+(\.\d+)?$/
const db = await loadStations()
const accepted = new Set(db.accepted.map((s) => s.id))
// The accepted NOAA row is the one the site's station page shows; the test checks the two agree.
const ids = new Map(db.stationRoutes('tide').map((r) => [r.path, r.stationIds.find((id) => id.startsWith('noaa/') && accepted.has(id))]))
const ymd = (t) => new Date(t).toISOString().slice(0, 10).replaceAll('-', '')

/** Milliseconds for "2026-11-27 15:39" in GMT, or NaN for anything that isn't a real minute. */
function parseTime(text) {
  const parts = TIME.exec(text)?.slice(1).map(Number)
  if (!parts) return NaN
  const [y, mo, d, h, mi] = parts
  const t = Date.UTC(y, mo - 1, d, h, mi)
  const back = new Date(t)
  // Date.UTC rolls February 30 into March; a round trip catches it.
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d && h < 24 && mi < 60 ? t : NaN
}

const lines = []
for (const { slug, months: [from, to], seasons, stations } of KING_TIDE_REGIONS) {
  if (!seasons.length) throw new Error(`${slug}: no seasons`)
  for (const [path] of stations) {
    const id = ids.get(path)
    if (!id) throw new Error(`${path}: no accepted NOAA station on this route`)
    for (const year of seasons) {
      const label = `${path} ${year}`
      const start = Date.UTC(year, from - 1, 1) - PAD_DAYS * DAY
      const end = Date.UTC(to <= from ? year + 1 : year, to - 1, 1) + PAD_DAYS * DAY
      const query = new URLSearchParams({
        product: 'predictions', interval: 'hilo', datum: NOAA_DATUM, units: 'english', time_zone: 'gmt', format: 'json',
        station: id.slice('noaa/'.length), begin_date: ymd(start), end_date: ymd(end),
        application: 'slackwater.xyz',
      })
      // CO-OPS asks for a pause between calls; it throttles heavy users.
      await new Promise((resolve) => setTimeout(resolve, 500))
      const response = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${query}`, { signal: AbortSignal.timeout(30_000) })
      if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`)
      const { predictions, error } = await response.json()
      if (!Array.isArray(predictions) || !predictions.length) throw new Error(`${label}: ${error?.message ?? 'no predictions'}`)

      // Every row, lows included, so a missing high shows up as two lows in a row.
      const rows = predictions.map((p, i) => {
        const row = { type: p.type, time: parseTime(p.t), level: FEET.test(p.v) ? Number(p.v) : NaN }
        if (!['H', 'L'].includes(row.type) || !Number.isFinite(row.time) || !Number.isFinite(row.level)) throw new Error(`${label}: unreadable row ${i}: ${JSON.stringify(p)}`)
        return row
      })
      rows.forEach((row, i) => {
        const previous = rows[i - 1]
        if (previous && (row.time <= previous.time || row.type === previous.type)) throw new Error(`${label}: rows out of order or a turn missing at ${i}`)
      })
      if (rows[0].time > start + DAY || rows.at(-1).time < end - DAY) throw new Error(`${label}: predictions stop short of the season`)

      // Highs as flattened [minutes since the epoch, thousandths of a foot] pairs.
      const highs = rows.filter((r) => r.type === 'H').flatMap((r) => [r.time / 60_000, Math.round(r.level * 1000)])
      lines.push(`${JSON.stringify(label)}:${JSON.stringify({ station: id, datum: NOAA_DATUM, highs })}`)
    }
  }
}
writeFileSync(new URL('../src/data/noaa-king-tides.json', import.meta.url), `{\n${lines.join(',\n')}\n}\n`)
console.log(`${lines.length} station-seasons`)
