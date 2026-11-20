/**
 * The measurement behind the seam constants in `readings.ts`, run by
 * `tools/measure-chs-seam.mjs` and skipped everywhere else. Everything it
 * needs is imported inside the test, so a normal `npm test` only skips it.
 *
 * In `ports` mode it lists the merged tide ports for the tool to record.
 * In `measure` mode it replays each recorded station-local day through the
 * site's own `fetchRefinement`, as the page reads it, and writes a summary:
 * the step between DFO's curve and the computed one at both ends of DFO's
 * hours, the time from each DFO turn to the nearest computed turn of its
 * kind, the days not joined and why, the fast-water marks the ease makes,
 * and every port and day it skipped. It fails, after writing the summary,
 * when the run is partial: a port with no recorded answer, or a recorded day
 * the replay can't read.
 */
import { describe, it } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { flowPeaks as FlowPeaks, rateAt as RateAt, tideRates as TideRates } from '@slackwater/engine'
import type { IwlsStation } from './iwls'
import type { BundledStation } from './station'

const DIR = process.env.CHS_SEAM_DIR
const MODE = process.env.CHS_SEAM_MODE
const FIRST = process.env.CHS_SEAM_FIRST
const DAYS = Number(process.env.CHS_SEAM_DAYS ?? 15)

async function merged() {
  const { loadCatalogue } = await import('./catalogue')
  return loadCatalogue().filter((s): s is BundledStation => s.source === 'bundled' && !!s.chs && s.kind === 'tide')
}

describe.skipIf(!DIR)('the CHS seam measurement', () => {
  it.runIf(MODE === 'ports')('lists the merged tide ports', async () => {
    const ports = (await merged()).map((s) => ({ id: s.id, path: s.path, latitude: s.latitude, longitude: s.longitude }))
    writeFileSync(join(DIR!, 'ports.json'), JSON.stringify(ports))
  })

  it.runIf(MODE === 'measure')('measures each recorded day', { timeout: 900_000 }, async () => {
    const { computedReadings, SEAM_FAST_MPH, SEAM_STEP_LIMIT_FT, seamFor, spliceReadings } = await import('./readings')
    const { dayStart } = await import('./format')
    const { nearestStation } = await import('./iwls')
    const { predictSeries, tideExtremes } = await import('./predict')
    const { fetchRefinement } = await import('./refine')
    // The rate helpers the strip marks fast water with: those of the engine
    // `@slackwater/react` resolves, nested under it when it needs a newer
    // release than the site's.
    const { flowPeaks, rateAt, tideRates } = (await import(pathToFileURL([
      'node_modules/@slackwater/react/node_modules/@slackwater/engine/dist/index.js',
      'node_modules/@slackwater/engine/dist/index.js',
    ].map((p) => resolve(p)).find((p) => existsSync(p))!).href)) as {
      flowPeaks: typeof FlowPeaks; rateAt: typeof RateAt; tideRates: typeof TideRates
    }

    const stations: IwlsStation[] = JSON.parse(readFileSync(join(DIR!, 'stations.json'), 'utf8'))
    const steps: { port: string; step: number }[] = []
    const gaps: number[] = []
    const spacing: number[] = []
    const easeMarks: { port: string; day: string; rate: number; ours: number }[] = []
    const refused: { port: string; day: string; why: 'step' | 'no room to ease' | 'no samples inside' }[] = []
    const skipped = {
      /** No DFO station within the site's 3 km: the site shows these ports computed. */
      unmatched: [] as string[],
      /** Matched, but the tool recorded nothing: a partial run. */
      notRecorded: [] as string[],
      /** DFO has no `wlp` or `wlp-hilo` for the station: the site's fetch fails the same way. */
      noSeries: [] as string[],
      /** Recorded, but the replay could not read the day: a partial run. */
      failedDays: [] as string[],
    }
    let unpairedTurns = 0
    let portDays = 0
    for (const station of await merged()) {
      const match = nearestStation(stations, station.latitude, station.longitude)
      if (!match) {
        skipped.unmatched.push(station.path)
        continue
      }
      const file = join(DIR!, 'data', `${match.id}.json`)
      if (!existsSync(file)) {
        skipped.notRecorded.push(station.path)
        continue
      }
      const recorded = JSON.parse(readFileSync(file, 'utf8'))
      if (!recorded.wlp || !recorded['wlp-hilo']) {
        skipped.noSeries.push(station.path)
        continue
      }
      // Serves the recorded series cut to each request's window, as IWLS would.
      const fetcher: typeof fetch = async (input) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/stations')) return { ok: true, json: async () => stations } as Response
        const series = recorded[url.searchParams.get('time-series-code')!] as { eventDate: string }[]
        const from = Date.parse(url.searchParams.get('from')!)
        const to = Date.parse(url.searchParams.get('to')!)
        return { ok: true, json: async () => series.filter((p) => Date.parse(p.eventDate) >= from && Date.parse(p.eventDate) <= to) } as Response
      }
      for (let d = 0; d < DAYS; d++) {
        // Noon on each station-local day from the first.
        const noon = new Date(dayStart(new Date(`${FIRST}T12:00:00Z`), station.timezone, d).getTime() + 12 * 3600_000)
        const label = dayStart(noon, station.timezone).toISOString().slice(0, 10)
        let day
        try {
          day = await fetchRefinement(station, noon, fetcher)
        } catch (e) {
          skipped.failedDays.push(`${station.path} ${label}: ${e instanceof Error ? e.message : e}`)
          continue
        }
        if (day.kind !== 'tide') continue
        portDays++
        const end = day.start.getTime() + day.hours * 3600_000
        const inside = day.samples.filter((p) => p.time.getTime() >= day.start.getTime() && p.time.getTime() < end)
        if (!inside.length) {
          refused.push({ port: station.path, day: label, why: 'no samples inside' })
          continue
        }
        const at = (t: Date) => predictSeries(station, t, 1 / 3600, 1)[0].level
        for (const edge of [inside[0], inside[inside.length - 1]]) steps.push({ port: station.path, step: edge.level - at(edge.time) })
        const computed = tideExtremes(station, new Date(day.start.getTime() - 6 * 3600_000), day.hours + 12)
        for (const t of day.turns) {
          const twins = computed.filter((c) => c.high === t.high).map((c) => Math.abs(c.time.getTime() - t.time.getTime()))
          if (twins.length) gaps.push(Math.min(...twins) / 60_000)
          else unpairedTurns++
        }
        for (const high of [true, false]) {
          const ts = day.turns.filter((t) => t.high === high).map((t) => t.time.getTime())
          for (let i = 1; i < ts.length; i++) spacing.push((ts[i] - ts[i - 1]) / 3600_000)
        }
        if (!seamFor(station, day)) {
          const capped = [inside[0], inside[inside.length - 1]].some((e) => Math.abs(e.level - at(e.time)) > SEAM_STEP_LIMIT_FT)
          refused.push({ port: station.path, day: label, why: capped ? 'step' : 'no room to ease' })
          continue
        }
        // Fast water the ease makes: a mark the strip draws on the joined
        // curve where neither the computed curve nor DFO's runs that fast.
        const around = computedReadings(station, new Date(day.start.getTime() - 12 * 3600_000), day.hours + 24)
        const joined = spliceReadings(station, around, day)
        if (joined.kind !== 'tide' || around.kind !== 'tide') continue
        const rate = (timeline: { time: Date; level: number }[], t: Date) => rateAt(tideRates(timeline, 'feet'), t) ?? 0
        for (const peak of flowPeaks(tideRates(joined.timeline, 'feet'), SEAM_FAST_MPH)) {
          const ours = Math.abs(rate(around.timeline, peak.time))
          const theirs = Math.abs(rate(inside, peak.time))
          if (ours < SEAM_FAST_MPH && theirs < SEAM_FAST_MPH) easeMarks.push({ port: station.path, day: label, rate: Math.abs(peak.rate), ours })
        }
      }
    }
    const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
    const step = steps.map((s) => Math.abs(s.step)).sort((a, b) => a - b)
    gaps.sort((a, b) => a - b)
    const portMax = new Map<string, number>()
    for (const s of steps) portMax.set(s.port, Math.max(portMax.get(s.port) ?? 0, Math.abs(s.step)))
    const under = [...portMax].filter(([, m]) => m <= SEAM_STEP_LIMIT_FT).map(([, m]) => m)
    const partial = skipped.notRecorded.length > 0 || skipped.failedDays.length > 0
    const summary = {
      first: FIRST, days: DAYS, portDays, partial,
      stepFt: { ...Object.fromEntries([0.5, 0.95, 0.99].map((p) => [`p${p * 100}`, pct(step, p)])), max: step.at(-1) ?? null },
      portsOverStepLimit: [...portMax].filter(([, m]) => m > SEAM_STEP_LIMIT_FT).map(([p, m]) => `${p} ${m.toFixed(1)} ft`),
      maxStepOtherPortsFt: under.length ? Math.max(...under) : null,
      twinGapMin: Object.fromEntries([0.5, 0.95, 0.99].map((p) => [`p${p * 100}`, pct(gaps, p)])),
      unpairedTurns,
      closestDfoSameKindTurnsH: spacing.length ? Math.min(...spacing) : null,
      notJoined: {
        step: refused.filter((r) => r.why === 'step').map((r) => `${r.port} ${r.day}`),
        noRoomToEase: refused.filter((r) => r.why === 'no room to ease').map((r) => `${r.port} ${r.day}`),
        noSamplesInside: refused.filter((r) => r.why === 'no samples inside').map((r) => `${r.port} ${r.day}`),
      },
      easeMadeFastWater: {
        count: easeMarks.length,
        worst: [...easeMarks].sort((a, b) => b.rate - a.rate).slice(0, 10)
          .map((m) => `${m.port} ${m.day} ${m.rate.toFixed(2)} m/h (computed ${m.ours.toFixed(2)})`),
      },
      skipped,
    }
    writeFileSync(join(DIR!, 'summary.json'), JSON.stringify(summary, null, 2))
    if (partial) {
      throw new Error(
        `Partial run: ${skipped.notRecorded.length} ports with no recorded answer and ${skipped.failedDays.length} ` +
          'recorded days the replay could not read. See summary.json; record again before trusting the numbers.',
      )
    }
  })
})
