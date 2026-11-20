// Re-measures the bounds behind the seam constants in src/lib/readings.ts
// (SEAM_TWIN_MS, SEAM_RAMP_MS, SEAM_STEP_LIMIT_FT) against DFO's own days.
//
//   node tools/measure-chs-seam.mjs [dir] [first-day] [days]
//
// For every merged tide port the database gives a CHS identity, it records
// DFO's `wlp` (at FIFTEEN_MINUTES) and `wlp-hilo`, the series the site's
// fetchPortTides reads, for the station-local days from `first-day` (default:
// tomorrow, UTC) for `days` days (default 15, a spring-neap cycle). It asks
// differently from the site: one range per port covering every day plus a
// day either side (17 days by default) where the site asks one day at a time,
// and it matches DFO stations within 3.2 km where the site matches within 3,
// which only records a spare station. Plain HTTP to api-iwls.dfo-mpo.gc.ca,
// paced under IWLS's documented 30 requests a minute; about a quarter of an
// hour in all. It then replays each day through the site's own
// fetchRefinement, cutting the recorded range to each request the site makes,
// and prints the summary: the step between DFO's curve and the computed one at
// the day's edges, the time from each DFO turn to its computed twin, the ports
// past the step limit, the days not joined, the fast-water marks the ease
// makes, and every port and day it skipped. It exits non-zero on a partial
// run: a port with no recorded answer, or a recorded day the replay can't
// read. Responses are kept in `dir` (default: a folder in the system temp
// dir), so a second run reuses them; delete `dir/data` to record afresh.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = process.argv[2] ?? join(tmpdir(), 'slackwater-chs-seam')
const first = process.argv[3] ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
const days = Number(process.argv[4] ?? 15)
mkdirSync(join(dir, 'data'), { recursive: true })

const BASE = 'https://api-iwls.dfo-mpo.gc.ca/api/v1'
// A day either side, so every station-local day in the span is whole.
const from = new Date(Date.parse(`${first}T00:00:00Z`) - 86_400_000).toISOString()
const to = new Date(Date.parse(`${first}T00:00:00Z`) + (days + 1) * 86_400_000).toISOString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PACE_MS = 2200

const vitest = (mode) =>
  execFileSync('npx', ['vitest', 'run', 'src/lib/chs-seam.measure.test.ts'], {
    stdio: 'inherit',
    env: { ...process.env, CHS_SEAM_DIR: dir, CHS_SEAM_MODE: mode, CHS_SEAM_FIRST: first, CHS_SEAM_DAYS: String(days) },
  })

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    // No such series for this station: the site's fetch fails the same way and keeps the computed day.
    if (res.status === 404) return null
    await sleep(10_000)
  }
  throw new Error(`IWLS kept failing: ${url}`)
}

const km = (a, b) => {
  const rad = Math.PI / 180
  const h = Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

vitest('ports')
const ports = JSON.parse(readFileSync(join(dir, 'ports.json'), 'utf8'))
if (!existsSync(join(dir, 'stations.json'))) {
  writeFileSync(join(dir, 'stations.json'), JSON.stringify(await get(`${BASE}/stations?time-series-code=wlp`)))
  await sleep(PACE_MS)
}
const stations = JSON.parse(readFileSync(join(dir, 'stations.json'), 'utf8'))
const wanted = new Set()
for (const p of ports) {
  const [best] = stations.map((s) => [s, km(p, s)]).sort((a, b) => a[1] - b[1])
  // fetchPortTides resolves within 3 km; a little slack here only records a spare station.
  if (best && best[1] <= 3.2) wanted.add(best[0].id)
}
console.log(`${ports.length} merged ports, ${wanted.size} DFO stations, ${first} for ${days} days`)
for (const id of wanted) {
  const file = join(dir, 'data', `${id}.json`)
  if (existsSync(file)) continue
  const series = (code, resolution) =>
    `${BASE}/stations/${id}/data?time-series-code=${code}&from=${from}&to=${to}${resolution ? '&resolution=FIFTEEN_MINUTES' : ''}`
  const wlp = await get(series('wlp', true))
  await sleep(PACE_MS)
  const hilo = await get(series('wlp-hilo', false))
  await sleep(PACE_MS)
  writeFileSync(file, JSON.stringify({ id, wlp, 'wlp-hilo': hilo }))
}
// The replay fails on a partial run after writing the summary, so print it either way.
rmSync(join(dir, 'summary.json'), { force: true })
let failed = false
try {
  vitest('measure')
} catch {
  failed = true
}
if (!existsSync(join(dir, 'summary.json'))) process.exit(1)
const summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'))
console.log(JSON.stringify(summary, null, 2))
const { unmatched, noSeries, notRecorded, failedDays } = summary.skipped
console.log(`Skipped: ${unmatched.length} ports with no DFO station within 3 km, ${noSeries.length} with no DFO series.`)
if (failed || summary.partial) {
  console.error(
    `PARTIAL RUN: ${notRecorded.length} ports with no recorded answer, ${failedDays.length} recorded days the replay could not read. ` +
      'These numbers do not cover every merged port; record again before updating the seam constants.',
  )
  process.exit(1)
}
