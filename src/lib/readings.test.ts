import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { flowPeaks as FlowPeaks, tideRates as TideRates } from '@slackwater/engine'
import {
  computedReadings, currentEvents, publishedReadings, SEAM_RAMP_MS, SEAM_TWIN_MS, seamFor, spliceReadings, type Published, type Readings,
} from './readings'
import { DAY_BEFORE, DAY_OF, MIDNIGHT_HIGH, MIDNIGHT_PORT } from './__fixtures__/seam'
import { loadCatalogue } from './catalogue'
import { predictSeries } from './predict'
import { dfoDay, SEAM_DAY, SEAM_END, SEAM_HIGH, SEAM_PORT } from './__fixtures__/seam'
import type { BundledStation } from './station'

/**
 * The rate helpers the strip itself marks fast water with: those of the
 * engine `@slackwater/react` resolves, which npm nests under the package when
 * it needs a newer release than the site's own. The package doesn't re-export
 * them, so this loads that engine the way Node would find it from the package.
 */
const { flowPeaks, tideRates } = (await import(pathToFileURL([
  'node_modules/@slackwater/react/node_modules/@slackwater/engine/dist/index.js',
  'node_modules/@slackwater/engine/dist/index.js',
].map((p) => resolve(p)).find((p) => existsSync(p))!).href)) as { flowPeaks: typeof FlowPeaks; tideRates: typeof TideRates }

const SEATTLE: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'Seattle', path: '/tides/us/wa/seattle/',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles', source: 'bundled', chartDatum: 'MLLW',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}

const start = new Date('2026-09-01T07:00:00Z')
const day = { start: new Date('2026-09-02T07:00:00Z'), hours: 24 }
const from = day.start.getTime()
const to = from + day.hours * 3600_000
const inside = (p: { time: Date }) => p.time.getTime() >= from && p.time.getTime() < to

/**
 * A fake DFO day: every fifteen minutes across the window, a quarter-foot
 * above the computed curve, so it is joined (well under the step cap) and
 * every height inside is one no predictor gives; and one turn.
 */
const MARK = 0.25
const marked = (t: Date) => predictSeries(SEATTLE, t, 1 / 3600, 1)[0].level + MARK
const publishedTide = (window: { start: Date; hours: number }): Published & { start: Date; hours: number } => ({
  kind: 'tide',
  ...window,
  samples: Array.from({ length: window.hours * 4 + 1 }, (_, i) => {
    const time = new Date(window.start.getTime() + i * 900_000)
    return { time, level: marked(time) }
  }),
  turns: [{ time: new Date(window.start.getTime() + 6 * 3600_000), level: 43, high: true }],
})
const isMarked = (p: { time: Date; level: number }) => p.level === marked(p.time)
/** Within `SEAM_TWIN_MS` of either end of the fake day, where a computed turn with no twin stays. */
const nearEdge = (p: { time: Date }) => p.time.getTime() - from <= SEAM_TWIN_MS || to - p.time.getTime() <= SEAM_TWIN_MS

describe('spliceReadings', () => {
  const computed = computedReadings(SEATTLE, start, 72)
  /** Computed water farther from CHS's hours than the ease reaches. */
  const beyond = (window: { from: number; to: number }) => (p: { time: Date }) =>
    p.time.getTime() < window.from - SEAM_RAMP_MS || p.time.getTime() > window.to + SEAM_RAMP_MS

  it("puts CHS's day in place of everything it covers, and leaves the water beyond its seams computed", () => {
    const spliced = spliceReadings(SEATTLE, computed, publishedTide(day))
    if (spliced.kind !== 'tide' || computed.kind !== 'tide') throw new Error('kind')
    expect(spliced.timeline.filter(inside).every(isMarked)).toBe(true)
    const far = beyond({ from, to: to - 900_000 })
    expect(spliced.timeline.filter(far)).toEqual(computed.timeline.filter(far))
    expect(spliced.extremes.filter(inside)).toContainEqual(expect.objectContaining({ level: 43, high: true, low: false, label: 'High' }))
    expect(spliced.extremes.filter((e) => inside(e) && e.level !== 43).every(nearEdge)).toBe(true)
    expect(spliced.extremes.filter(far)).toEqual(computed.extremes.filter(far))
    const times = spliced.timeline.map((p) => p.time.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    // Not merely shorter: the window keeps both ends.
    expect(spliced.timeline[0].time).toEqual(computed.timeline[0].time)
    expect(spliced.timeline.at(-1)!.time).toEqual(computed.timeline.at(-1)!.time)
  })

  it('replaces only the hours DFO actually sent', () => {
    // A short answer: samples for the first six hours of the day asked for.
    const full = publishedTide(day)
    const short = { ...full, samples: full.samples.filter((p) => p.time.getTime() <= from + 6 * 3600_000) }
    const spliced = spliceReadings(SEATTLE, computed, short)
    if (spliced.kind !== 'tide' || computed.kind !== 'tide') throw new Error('kind')
    const after = (p: { time: Date }) => p.time.getTime() > from + 6 * 3600_000 + SEAM_RAMP_MS
    expect(spliced.timeline.filter(after)).toEqual(computed.timeline.filter(after))
    expect(spliced.extremes.filter(after)).toEqual(computed.extremes.filter(after))
    const covered = (p: { time: Date }) => inside(p) && p.time.getTime() <= from + 6 * 3600_000
    expect(spliced.timeline.filter(covered).every(isMarked)).toBe(true)
  })

  it('changes nothing for a day outside the window', () => {
    expect(spliceReadings(SEATTLE, computed, publishedTide({ start: new Date('2026-10-01T07:00:00Z'), hours: 24 }))).toBe(computed)
  })

  it("leaves no computed lull under CHS's curve, which has none", () => {
    const subordinate = loadCatalogue().find((s): s is BundledStation => s.source === 'bundled' && s.id === 'noaa/ACT7291')!
    const window = { start: new Date('2026-09-01T00:00:00Z'), hours: 72 }
    const ours = computedReadings(subordinate, window.start, window.hours)
    if (ours.kind !== 'current') throw new Error('kind')
    const lulls = ours.events.filter((e) => e.kind === 'minFlood' || e.kind === 'minEbb')
    expect(lulls.length).toBeGreaterThan(0)
    // DFO's hours run two hours either side of the lull, well clear of the
    // edges where a computed turn with no DFO twin is kept.
    const from = new Date(lulls[0].time.getTime() - 2 * 3600_000)
    const until = from.getTime() + 4 * 3600_000
    const spliced = spliceReadings(subordinate, ours, {
      kind: 'current',
      start: from,
      hours: 4,
      samples: Array.from({ length: 9 }, (_, i) => ({ time: new Date(from.getTime() + i * 1800_000), level: 0.2 })),
      events: [],
    })
    if (spliced.kind !== 'current') throw new Error('kind')
    expect(spliced.events.map((e) => +e.time)).not.toContain(+lulls[0].time)
    const outside = (e: { time: Date }) => e.time < from || e.time.getTime() >= until
    expect(spliced.events.filter(outside)).toEqual(ours.events.filter(outside))
  })

  it('drops a computed lull just inside DFO’s hours too, where a high or low would stay', () => {
    // Twenty minutes in: within the edge where a turn with no DFO twin stays,
    // but DFO publishes no lulls, so there is no twin it could have missed.
    const subordinate = loadCatalogue().find((s): s is BundledStation => s.source === 'bundled' && s.id === 'noaa/ACT7291')!
    const ours = computedReadings(subordinate, new Date('2026-09-01T00:00:00Z'), 72)
    if (ours.kind !== 'current') throw new Error('kind')
    const lull = ours.events.find((e) => e.kind === 'minFlood' || e.kind === 'minEbb')!
    const from = new Date(lull.time.getTime() - 20 * 60_000)
    const spliced = spliceReadings(subordinate, ours, {
      kind: 'current',
      start: from,
      hours: 4,
      samples: Array.from({ length: 9 }, (_, i) => ({ time: new Date(from.getTime() + i * 1800_000), level: 0.2 })),
      events: [],
    })
    if (spliced.kind !== 'current') throw new Error('kind')
    expect(spliced.events.map((e) => +e.time)).not.toContain(+lull.time)
  })
})

describe('the seam where CHS meets the computed curve', () => {
  // See `__fixtures__/seam.ts`: half a foot of step, DFO's turns six minutes
  // early, and a computed high two minutes past the end of DFO's hours.
  const PORT = SEAM_PORT
  const layer = SEAM_DAY
  const high = SEAM_HIGH
  const end = SEAM_END
  const chsStart = layer.start
  const window = { start: new Date('2026-09-01T00:00:00Z'), hours: 96 }
  const computed = computedReadings(PORT, window.start, window.hours)
  if (computed.kind !== 'tide') throw new Error('kind')
  const spliced = spliceReadings(PORT, computed, layer)
  if (spliced.kind !== 'tide') throw new Error('kind')

  it('keeps one of each turn: no computed High beside DFO’s own', () => {
    for (const kind of [true, false]) {
      const times = spliced.extremes.filter((e) => e.high === kind).map((e) => e.time.getTime())
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThan(SEAM_TWIN_MS)
    }
    expect(spliced.extremes.map((e) => +e.time)).not.toContain(+high.time)
  })

  it('does not join a day stepping past the cap at all', () => {
    // Five feet, past every merged port's measured step but Mill Bay's: eased,
    // it would draw tide that never ran; bare, a cliff marked as fast water.
    const apart = dfoDay(PORT, layer.start, 21, -5)
    expect(seamFor(PORT, apart)).toBeUndefined()
    const kept = spliceReadings(PORT, computed, apart)
    // The strip stays computed: none of DFO's samples or turns, and no fast
    // water at either edge, since nothing joins there.
    expect(kept).toBe(computed)
    expect(flowPeaks(tideRates(computed.timeline, 'feet'), 0.6)).toEqual([])
  })

  it('reports which ends it eased, so the credit claims an ease only where there was one', () => {
    expect(seamFor(PORT, layer)?.eased).toEqual({ before: true, after: true })
    // Three feet, inside the measured range, is joined and eased.
    expect(seamFor(PORT, dfoDay(PORT, layer.start, 21, -3))?.eased).toEqual({ before: true, after: true })
    // No step to meet at all, and so nothing eased.
    expect(seamFor(PORT, dfoDay(PORT, layer.start, 21, 0))?.eased).toEqual({ before: false, after: false })
  })

  it('reads DFO’s day the same in any order, and without a point it cannot read', () => {
    const shuffled = {
      ...layer,
      samples: [...layer.samples].reverse().concat([{ time: new Date(Number.NaN), level: 3 }, { time: layer.start, level: Number.NaN }]),
      turns: [...layer.turns].reverse(),
    }
    expect(spliceReadings(PORT, computed, shuffled)).toEqual(spliced)
    expect(seamFor(PORT, shuffled)?.eased).toEqual({ before: true, after: true })
  })

  it('marks no fast water at either seam', () => {
    // The strip marks each rising or falling run's fastest sample at 0.6 m an
    // hour or more. A bare half-foot step across one sample reaches that.
    const peaks = flowPeaks(tideRates(spliced.timeline, 'feet'), 0.6)
    expect(peaks).toEqual([])
  })

  it('makes no fast water of its own on a large step beside water already running near the line', () => {
    // A port whose computed water peaks at about 0.45 m an hour, DFO's day
    // starting at a high and stepping 2.7 ft above it, the measured 99th
    // percentile: the ease before the day climbs with the rising water.
    // Spread evenly it pushed that past 0.6 m an hour; spread by the room
    // under the line it never does.
    const brisk = { ...SEAM_PORT, id: 'ticon/brisk', constituents: [{ name: 'M2', amplitude: 2.9, phase: 0 }] }
    const window = computedReadings(brisk, new Date('2026-09-01T00:00:00Z'), 96)
    if (window.kind !== 'tide') throw new Error('kind')
    const high = window.extremes.find((e) => e.high && e.time.getTime() > Date.parse('2026-09-02T12:00:00Z'))!
    const day = dfoDay(brisk, high.time, 24, 2.7)
    expect(seamFor(brisk, day)?.eased).toEqual({ before: true, after: true })
    const joined = spliceReadings(brisk, window, day)
    if (joined.kind !== 'tide') throw new Error('kind')
    // The computed water alone never reaches the line, so every mark would be the ease's.
    expect(flowPeaks(tideRates(window.timeline, 'feet'), 0.6)).toEqual([])
    expect(flowPeaks(tideRates(joined.timeline, 'feet'), 0.6)).toEqual([])
  })

  it('meets DFO’s curve without a step, and leaves DFO’s numbers exactly as published', () => {
    // DFO's hours are [start, start + hours): its sample at the very end is outside them.
    const ours = (p: { time: Date }) => p.time >= chsStart && p.time.getTime() < end
    const inside = spliced.timeline.filter(ours)
    expect(inside).toEqual(layer.samples.filter(ours).map((p) => ({ time: p.time, level: p.level })))
    expect(spliced.extremes.filter(ours))
      .toEqual(layer.turns.filter(ours).map((t) => expect.objectContaining({ time: t.time, level: t.level, high: t.high })))
    const next = spliced.timeline.find((p) => p.time.getTime() >= end)!
    const last = inside.at(-1)!
    // Ten minutes on, the computed side is within a few hundredths of DFO's
    // last sample rather than half a foot below it.
    expect(Math.abs(next.level - last.level)).toBeLessThan(0.1)
  })

  it('sits each computed turn beside the seam on the eased curve', () => {
    for (const e of spliced.extremes.filter((t) => t.time.getTime() > end)) {
      const on = spliced.timeline.find((p) => Math.abs(p.time.getTime() - e.time.getTime()) < 300_000)
      if (on) expect(Math.abs(on.level - e.level)).toBeLessThan(0.05)
    }
  })

  it('leaves the computed water beyond the ease exactly as computed', () => {
    const far = (p: { time: Date }) => p.time.getTime() > end + SEAM_RAMP_MS || p.time < new Date(chsStart.getTime() - SEAM_RAMP_MS)
    expect(spliced.timeline.filter(far)).toEqual(computed.timeline.filter(far))
  })

  it('drops a computed slack beside DFO’s own for a current, and eases no speed', () => {
    const gate = loadCatalogue().find((s): s is BundledStation => s.source === 'bundled' && s.id === 'noaa/PUG1701')!
    const ours = computedReadings(gate, window.start, 48)
    if (ours.kind !== 'current') throw new Error('kind')
    const slack = ours.events.find((e) => e.kind === 'slack' && e.time.getTime() > window.start.getTime() + 24 * 3600_000)!
    const stop = slack.time.getTime() - 120_000
    const from = new Date(stop - 6 * 3600_000)
    const current = spliceReadings(gate, ours, {
      kind: 'current',
      start: from,
      hours: 6,
      samples: Array.from({ length: 6 * 4 + 1 }, (_, i) => ({ time: new Date(from.getTime() + i * 900_000), level: 1 })),
      events: [{ kind: 'slack', time: new Date(slack.time.getTime() - 6 * 60_000), level: 0 }],
    })
    if (current.kind !== 'current') throw new Error('kind')
    expect(current.events.map((e) => +e.time)).not.toContain(+slack.time)
    const after = (p: { time: Date }) => p.time.getTime() > stop
    expect(current.timeline.filter(after)).toEqual(ours.timeline.filter(after))
  })
})

describe('the seam at midnight, where DFO is asked for one day', () => {
  // See `__fixtures__/seam.ts`: a computed high three minutes past midnight,
  // whose DFO twin falls at 23:57 the day before.
  const around = computedReadings(MIDNIGHT_PORT, new Date('2026-09-01T00:00:00Z'), 120)
  const highs = (r: Readings) => (r.kind === 'tide' ? r.extremes.filter((e) => e.high).map((e) => +e.time) : [])

  it('keeps a computed high just inside DFO’s day when DFO listed no twin for it', () => {
    // DFO's 3 September was fetched, its 2 September was not: the 23:57 twin
    // never arrived, and dropping the computed one would lose the high.
    const spliced = spliceReadings(MIDNIGHT_PORT, around, DAY_OF)
    expect(highs(spliced)).toContain(+MIDNIGHT_HIGH.time)
    if (spliced.kind !== 'tide') throw new Error('kind')
    // Labelled at its own computed height, the number the table prints and
    // the credit calls computed, not at a height read off DFO's curve that
    // DFO never published as a high.
    const dot = spliced.extremes.find((e) => +e.time === +MIDNIGHT_HIGH.time)!
    expect(dot.level).toBe(MIDNIGHT_HIGH.level)
  })

  it('labels a computed turn kept after DFO’s last sample at its own computed height', () => {
    // DFO's hours end ten minutes after the computed high, whose DFO twin
    // falls in the next day. Its last sample inside is 23:45-like, five
    // minutes before the high: past it the ease begins, but a kept turn
    // inside DFO's hours is drawn where the table prints it.
    const end = MIDNIGHT_HIGH.time.getTime() + 10 * 60_000
    const day = dfoDay(MIDNIGHT_PORT, new Date(end - 24 * 3600_000), 24)
    const without = { ...day, turns: day.turns.filter((t) => Math.abs(+t.time - +MIDNIGHT_HIGH.time) > SEAM_TWIN_MS) }
    const spliced = spliceReadings(MIDNIGHT_PORT, around, without)
    if (spliced.kind !== 'tide') throw new Error('kind')
    const dot = spliced.extremes.find((e) => +e.time === +MIDNIGHT_HIGH.time)!
    expect(dot.level).toBe(MIDNIGHT_HIGH.level)
  })

  it('drops a computed turn just past the edge window before the end of DFO’s hours when DFO lists none', () => {
    // The end's window is measured from the end of DFO's hours, not from its
    // last sample a quarter of an hour earlier: ten minutes past the window
    // from the end is outside it, though inside it from the last sample, so
    // DFO's own (empty) account of that hour stands.
    const end = MIDNIGHT_HIGH.time.getTime() + SEAM_TWIN_MS + 10 * 60_000
    const day = dfoDay(MIDNIGHT_PORT, new Date(end - 24 * 3600_000), 24)
    const without = { ...day, turns: day.turns.filter((t) => Math.abs(+t.time - +MIDNIGHT_HIGH.time) > SEAM_TWIN_MS) }
    const spliced = spliceReadings(MIDNIGHT_PORT, around, without)
    expect(highs(spliced)).not.toContain(+MIDNIGHT_HIGH.time)
  })

  it('still drops it when DFO did list the twin, whatever window the strip shows', () => {
    // A strip whose window starts at midnight on the 3rd, after DFO's day
    // for the 2nd has ended: the seam comes from DFO's hours, not the window.
    const tomorrow = computedReadings(MIDNIGHT_PORT, new Date('2026-09-03T00:00:00Z'), 48)
    const spliced = spliceReadings(MIDNIGHT_PORT, tomorrow, DAY_BEFORE)
    expect(highs(spliced)).not.toContain(+MIDNIGHT_HIGH.time)
    if (spliced.kind !== 'tide' || tomorrow.kind !== 'tide') throw new Error('kind')
    // Tomorrow's first hours are eased onto DFO's day, and none of DFO's
    // samples hang off the start of the window.
    expect(spliced.timeline[0].time).toEqual(tomorrow.timeline[0].time)
    expect(spliced.timeline[0].level).toBeCloseTo(tomorrow.timeline[0].level - 0.5, 1)
    expect(spliced.timeline.at(-1)).toEqual(tomorrow.timeline.at(-1))
  })
})

describe('publishedReadings', () => {
  it("keeps DFO's published magnitude and Set beside the signed value, and names its events", () => {
    const read = publishedReadings({
      kind: 'current',
      samples: [{ time: start, level: -2, magnitude: 2.1, direction: 150 }],
      events: [
        { kind: 'slack', time: start, level: 0 },
        { kind: 'flood', time: start, level: 3 },
        { kind: 'ebb', time: start, level: -3 },
      ],
    })
    expect(read).toEqual({
      kind: 'current',
      timeline: [{ time: start, speed: -2, magnitude: 2.1, direction: 150 }],
      events: [
        { time: start, speed: 0, kind: 'slack' },
        { time: start, speed: 3, kind: 'maxFlood' },
        { time: start, speed: -3, kind: 'maxEbb' },
      ],
    })
  })
})

describe('currentEvents', () => {
  it('gives maxima and lulls the set they run toward, and a slack none', () => {
    const station = loadCatalogue().find((s): s is BundledStation => s.source === 'bundled' && s.id === 'noaa/PUG1701')!
    const events = currentEvents(station, start, 24)
    expect(events.find((e) => e.kind === 'slack')).not.toHaveProperty('direction')
    expect(events.find((e) => e.kind === 'maxFlood')?.direction).toBe(station.floodDirection)
    expect(events.find((e) => e.kind === 'maxEbb')?.direction).toBe(station.ebbDirection)
  })
})
