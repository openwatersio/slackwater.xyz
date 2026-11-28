/**
 * Merged ports with a step where CHS's day meets their computed curve, for the
 * seam tests of the strip (`readings.test.ts`) and the 7-day table
 * (`StationPage.test.tsx`).
 *
 * DFO's curve sits half a foot under the computed one, by datum and model,
 * and DFO times each turn six minutes earlier, as the recorded Victoria and
 * Tofino days in `iwls-ports.json` do. Only M2, so the water itself never runs
 * as fast as the 0.6 m an hour at which the strip marks fast water: any mark
 * is the seam's.
 */
import { predictSeries, tideExtremes } from '../predict'
import type { Refined } from '../refine'
import type { BundledStation } from '../station'

const STEP = -0.5
const EARLY_MS = 6 * 60_000

/**
 * DFO's day for `station` over [start, start + hours), as `fetchRefinement`
 * would hand it over: samples every fifteen minutes, and the turns whose
 * DFO times fall inside the hours, as `wlp-hilo` lists only those.
 */
export function dfoDay(station: BundledStation, start: Date, hours: number, step = STEP): Refined & { kind: 'tide' } {
  const end = start.getTime() + hours * 3600_000
  const samples = Array.from({ length: hours * 4 + 1 }, (_, i) => {
    const time = new Date(start.getTime() + i * 900_000)
    return { time, level: predictSeries(station, time, 1 / 3600, 1)[0].level + step }
  })
  const turns = tideExtremes(station, new Date(start.getTime() - 3600_000), hours + 2)
    .map((t) => ({ ...t, time: new Date(t.time.getTime() - EARLY_MS), level: t.level + step }))
    .filter((t) => t.time >= start && t.time.getTime() < end)
  return {
    kind: 'tide', start, hours, samples, turns,
    high: turns.reduce((a, b) => (b.level > a.level ? b : a)),
    low: turns.reduce((a, b) => (b.level < a.level ? b : a)),
  }
}

export const SEAM_PORT: BundledStation = {
  id: 'ticon/merged', kind: 'tide', slug: 'merged', name: 'Merged', path: '/tides/ca/bc/merged/',
  latitude: 48.4, longitude: -123.4, timezone: 'America/Vancouver', source: 'bundled', chartDatum: 'LAT',
  constituents: [{ name: 'M2', amplitude: 3, phase: 0 }], offset: 4, chs: { id: 'chs-merged' },
}

/** The computed high DFO's hours stop just short of. */
export const SEAM_HIGH = tideExtremes(SEAM_PORT, new Date('2026-09-03T00:00:00Z'), 24).find((e) => e.high)!

/** The end of DFO's hours, in ms: two minutes before `SEAM_HIGH`. */
export const SEAM_END = SEAM_HIGH.time.getTime() - 120_000

/**
 * DFO's hours end two minutes before a computed high and list that high
 * themselves six minutes earlier. They start 21 hours before, near the
 * falling tide's fastest, where a step down adds to the fall.
 */
export const SEAM_DAY = dfoDay(SEAM_PORT, new Date(SEAM_END - 21 * 3600_000), 21)

/** The first computed high after `at` for this port. */
const firstHigh = (station: BundledStation, at: Date) => tideExtremes(station, at, 24).find((e) => e.high)!

/**
 * A port on UTC with a computed high three minutes past midnight on
 * 3 September, so DFO's midnight-to-midnight days meet it at the seam: DFO's
 * twin, six minutes earlier, falls at 23:57 on the 2nd, inside the 2nd's day
 * and outside the 3rd's.
 */
export const MIDNIGHT_PORT: BundledStation = (() => {
  const midnight = Date.parse('2026-09-03T00:00:00Z')
  let best: BundledStation | undefined
  let miss = Infinity
  for (let phase = 0; phase < 360; phase++) {
    // Each phase has its own constituent array and cached predictor.
    const station: BundledStation = {
      ...SEAM_PORT, id: `ticon/midnight-${phase}`, timezone: 'UTC', constituents: [{ name: 'M2', amplitude: 3, phase }],
    }
    const off = Math.abs(firstHigh(station, new Date(midnight - 6 * 3600_000)).time.getTime() - (midnight + 3 * 60_000))
    if (off < miss) [best, miss] = [station, off]
  }
  return best!
})()

/** `MIDNIGHT_PORT`'s computed high just past midnight on 3 September. */
export const MIDNIGHT_HIGH = firstHigh(MIDNIGHT_PORT, new Date('2026-09-02T18:00:00Z'))

/** DFO's 2 September, which lists `MIDNIGHT_HIGH`'s twin six minutes before its end. */
export const DAY_BEFORE = dfoDay(MIDNIGHT_PORT, new Date('2026-09-02T00:00:00Z'), 24)

/** DFO's 3 September, which starts three minutes before `MIDNIGHT_HIGH` and lists no twin for it. */
export const DAY_OF = dfoDay(MIDNIGHT_PORT, new Date('2026-09-03T00:00:00Z'), 24)
