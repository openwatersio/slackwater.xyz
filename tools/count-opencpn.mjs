// Recounts the figures /opencpn/ quotes, for the @slackwater/database release
// this site is built against, and writes them to src/content/opencpn-counts.json.
//
//   node tools/count-opencpn.mjs [cache-dir]
//
// Run it after every database bump, then update src/content/opencpn.md to the
// figures it prints; content-routes.test.ts fails until the two agree. The
// TCD files are downloaded into the cache directory (default: a folder in the
// system temp dir) the first time, so the test never fetches anything.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { readIdx, readTcd } from './tcd.mjs'
import { qualityCounts } from './quality.mjs'

const require = createRequire(import.meta.url)
const { version } = require('@slackwater/database/package.json')
const date = version.match(/(\d{8})$/)?.[1]
if (!date) throw new Error(`database ${version} has no release date, so it has no TCD asset to count`)

/** The OpenCPN release whose bundled tide data the page compares against. */
const OPENCPN = 'Release_5.14.2'
const OPENCPN_FILES = ['harmonics-dwf-20210110-free.tcd', 'HARMONICS_NO_US.IDX', 'ticon-europe-global.tcd']

const cache = process.argv[2] ?? join(tmpdir(), 'slackwater-opencpn-counts')
mkdirSync(cache, { recursive: true })

/** Every file counted, with where it came from and the day it was fetched. */
const sources = {}

/**
 * Fetch once into the cache. A `.fetched` file beside each download keeps the
 * day it came down, because NOAA's station lists change and the page says
 * which day its figure describes.
 */
async function fetchTo(url, file) {
  const path = join(cache, file)
  const stamp = `${path}.fetched`
  if (!existsSync(path) || !existsSync(stamp)) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    writeFileSync(path, Buffer.from(await res.arrayBuffer()))
    writeFileSync(stamp, new Date().toISOString().slice(0, 10))
  }
  sources[file] = { url, fetched: readFileSync(stamp, 'utf8').trim() }
  return path
}

const tcdName = `slackwater-${date}.tcd`
const slackwater = readTcd(await fetchTo(
  `https://github.com/openwatersio/slackwater-database/releases/download/v${version}/${tcdName}`, tcdName))
const [dwf, world, ticon] = await Promise.all(OPENCPN_FILES.map((f) =>
  fetchTo(`https://raw.githubusercontent.com/OpenCPN/OpenCPN/${OPENCPN}/data/tcdata/${f}`, `${OPENCPN}-${f}`)))
const usFile = readTcd(dwf)
const worldFile = readIdx(world)
const ticonFile = readTcd(ticon)

const MDAPI = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type='
const noaaIds = async (type) => new Set(
  JSON.parse(readFileSync(await fetchTo(`${MDAPI}${type}`, `noaa-${type}.json`), 'utf8')).stations.map((s) => String(s.id)))
const noaaTides = await noaaIds('tidepredictions')
// A NOAA current id names the station, and `_<bin>` one depth of it.
const station = (id) => id.replace(/_\d+$/, '')
const noaaCurrents = new Set([...(await noaaIds('currentpredictions'))].map(station))

const cell = (s) => `${s.latitude.toFixed(2)},${s.longitude.toFixed(2)}`

/**
 * Unique station locations of one kind, as the page's table counts them:
 * positions rounded to 0.01° (about a kilometre), so a current published at
 * several depths, or one gauge relayed by two files, counts once.
 */
const locations = (stations, kind) => new Set(stations.filter((s) => s.kind === kind).map(cell)).size
const table = (stations) => ({ tide: locations(stations, 'tide'), current: locations(stations, 'current') })

const names = new Map()
for (const s of ticonFile) names.set(s.name, (names.get(s.name) ?? 0) + 1)

/**
 * Stations in OpenCPN's 2021 US file that NOAA no longer lists among the
 * stations it publishes predictions for, by NOAA id; a current counts once
 * however many depths it has. The US file's names end with the state, which
 * is how they are grouped.
 */
function retired(kind, listed) {
  const gone = new Map()
  for (const s of usFile.filter((x) => x.kind === kind)) {
    const id = kind === 'current' ? station(s.id) : s.id
    if (!listed.has(id) && !gone.has(id)) gone.set(id, s.name.replace(/ Current.*$/, '').split(',').at(-1).trim())
  }
  const states = {}
  for (const state of gone.values()) states[state] = (states[state] ?? 0) + 1
  return { count: gone.size, states: Object.fromEntries(Object.entries(states).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))) }
}

/** Boxes for the Canadian current points in OpenCPN's world file. */
const BOXES = {
  // British Columbia's coast, Juan de Fuca Strait to Dixon Entrance.
  britishColumbia: { south: 48.2, north: 55, west: -134, east: -122.7 },
  // The Bay of Fundy and its approaches off southwest Nova Scotia.
  bayOfFundy: { south: 43, north: 46, west: -67, east: -63 },
}
const inBox = (s, b) => s.latitude > b.south && s.latitude < b.north && s.longitude > b.west && s.longitude < b.east
const worldCurrents = worldFile.filter((s) => s.kind === 'current')

/**
 * OpenCPN 5.14 tide locations with no Slackwater tide station within 1 km,
 * the table's own resolution, by the file they come from; the world file's
 * by its country code (`Can`, `Jpn`, `Aus`, `PNGu`).
 */
const swTides = slackwater.filter((s) => s.kind === 'tide')
const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
const covered = (s) => swTides.some((t) => Math.abs(t.latitude - s.latitude) < 0.02 && km(s, t) <= 1)
const seen = new Set()
const extra = { total: 0, usFile: 0, worldFile: 0, ticonFile: 0, worldByCountry: {} }
for (const [file, stations] of [['usFile', usFile], ['worldFile', worldFile], ['ticonFile', ticonFile]]) {
  for (const s of stations.filter((x) => x.kind === 'tide')) {
    if (seen.has(cell(s))) continue
    seen.add(cell(s))
    if (covered(s)) continue
    extra.total++
    extra[file]++
    if (file === 'worldFile') extra.worldByCountry[s.country] = (extra.worldByCountry[s.country] ?? 0) + 1
  }
}
extra.worldByCountry = Object.fromEntries(Object.entries(extra.worldByCountry).sort(([a, x], [b, y]) => y - x || a.localeCompare(b)))

/**
 * NOAA current stations in OpenCPN's US file, by NOAA id, and how many of
 * them Slackwater's file carries too; the TCD's station id is the NOAA id
 * in both.
 */
const usCurrentIds = new Set(usFile.filter((s) => s.kind === 'current').map((s) => station(s.id)))
const swCurrentIds = new Set(slackwater.filter((s) => s.kind === 'current').map((s) => station(s.id)))
const usCurrents = {
  stations: usCurrentIds.size,
  inSlackwater: [...usCurrentIds].filter((id) => swCurrentIds.has(id)).length,
  missingRetired: [...usCurrentIds].filter((id) => !swCurrentIds.has(id) && !noaaCurrents.has(id)).length,
}

const counts = {
  database: version,
  tcd: tcdName,
  opencpn: OPENCPN,
  counted: new Date().toISOString().slice(0, 10),
  sources,
  quality: await qualityCounts(),
  slackwater: table(slackwater),
  // 5.14 turns on all three files; an install upgraded from 5.12 keeps two.
  opencpn514: table([...usFile, ...worldFile, ...ticonFile]),
  opencpn512: table([...usFile, ...worldFile]),
  ticonRepeatedNames: [...names.values()].filter((n) => n > 1).length,
  retired: {
    asOf: sources['noaa-tidepredictions.json'].fetched,
    tide: retired('tide', noaaTides),
    current: retired('current', noaaCurrents),
  },
  usCurrents,
  worldCurrents: {
    boxes: BOXES,
    britishColumbia: worldCurrents.filter((s) => inBox(s, BOXES.britishColumbia)).length,
    bayOfFundy: worldCurrents.filter((s) => inBox(s, BOXES.bayOfFundy)).length,
  },
  extraTides: extra,
}

writeFileSync(new URL('../src/content/opencpn-counts.json', import.meta.url), `${JSON.stringify(counts, null, 2)}\n`)
console.log(JSON.stringify(counts, null, 2))
