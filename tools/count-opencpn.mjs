// Recounts the figures /opencpn/ quotes, for the @slackwater/database release
// this site is built against, and writes them to src/content/opencpn-counts.json.
//
//   node tools/count-opencpn.mjs [cache-dir]
//
// Run it after every database bump, then update src/content/opencpn.md to the
// figures it prints; content-routes.test.ts fails until the two agree. The
// TCD files are downloaded into the cache directory (default: a folder in the
// system temp dir) the first time, so the test never fetches anything.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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

async function fetchTo(url, file) {
  const path = join(cache, file)
  if (existsSync(path)) return path
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  writeFileSync(path, Buffer.from(await res.arrayBuffer()))
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

/**
 * Unique station locations of one kind, as the page's table counts them:
 * positions rounded to 0.01° (about a kilometre), so a current published at
 * several depths, or one gauge relayed by two files, counts once.
 */
const locations = (stations, kind) =>
  new Set(stations.filter((s) => s.kind === kind).map((s) => `${s.latitude.toFixed(2)},${s.longitude.toFixed(2)}`)).size
const table = (stations) => ({ tide: locations(stations, 'tide'), current: locations(stations, 'current') })

const names = new Map()
for (const s of ticonFile) names.set(s.name, (names.get(s.name) ?? 0) + 1)

const counts = {
  database: version,
  tcd: tcdName,
  opencpn: OPENCPN,
  counted: new Date().toISOString().slice(0, 10),
  quality: await qualityCounts(),
  slackwater: table(slackwater),
  // 5.14 turns on all three files; an install upgraded from 5.12 keeps two.
  opencpn514: table([...usFile, ...worldFile, ...ticonFile]),
  opencpn512: table([...usFile, ...worldFile]),
  ticonRepeatedNames: [...names.values()].filter((n) => n > 1).length,
}

writeFileSync(new URL('../src/content/opencpn-counts.json', import.meta.url), `${JSON.stringify(counts, null, 2)}\n`)
console.log(JSON.stringify(counts, null, 2))
