import { describe, expect, it } from 'vitest'
import { computedReadings, currentEvents, publishedReadings, spliceReadings, type Published } from './readings'
import { loadCatalogue } from './catalogue'
import type { BundledStation } from './station'

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

/** A fake DFO day: every fifteen minutes across the window, at a height no predictor gives. */
const publishedTide = (window: { start: Date; hours: number }): Published & { start: Date; hours: number } => ({
  kind: 'tide',
  ...window,
  samples: Array.from({ length: window.hours * 4 + 1 }, (_, i) => ({
    time: new Date(window.start.getTime() + i * 900_000),
    level: 42,
  })),
  turns: [{ time: new Date(window.start.getTime() + 6 * 3600_000), level: 43, high: true }],
})

describe('spliceReadings', () => {
  const computed = computedReadings(SEATTLE, start, 72)

  it("puts CHS's day in place of everything it covers, and leaves every other moment computed", () => {
    const spliced = spliceReadings(computed, publishedTide(day))
    if (spliced.kind !== 'tide' || computed.kind !== 'tide') throw new Error('kind')
    expect(spliced.timeline.filter(inside).every((p) => p.level === 42)).toBe(true)
    expect(spliced.timeline.filter((p) => !inside(p))).toEqual(computed.timeline.filter((p) => !inside(p)))
    expect(spliced.extremes.filter(inside)).toEqual([expect.objectContaining({ level: 43, high: true, low: false, label: 'High' })])
    expect(spliced.extremes.filter((e) => !inside(e))).toEqual(computed.extremes.filter((e) => !inside(e)))
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
    const spliced = spliceReadings(computed, short)
    if (spliced.kind !== 'tide' || computed.kind !== 'tide') throw new Error('kind')
    const after = (p: { time: Date }) => p.time.getTime() > from + 6 * 3600_000
    expect(spliced.timeline.filter(after)).toEqual(computed.timeline.filter(after))
    expect(spliced.extremes.filter(after)).toEqual(computed.extremes.filter(after))
    expect(spliced.timeline.filter((p) => !after(p) && inside(p)).every((p) => p.level === 42)).toBe(true)
  })

  it('changes nothing for a day outside the window', () => {
    expect(spliceReadings(computed, publishedTide({ start: new Date('2026-10-01T07:00:00Z'), hours: 24 }))).toBe(computed)
  })

  it("leaves no computed lull under CHS's curve, which has none", () => {
    const subordinate = loadCatalogue().find((s): s is BundledStation => s.source === 'bundled' && s.id === 'noaa/ACT7291')!
    const window = { start: new Date('2026-09-01T00:00:00Z'), hours: 72 }
    const ours = computedReadings(subordinate, window.start, window.hours)
    if (ours.kind !== 'current') throw new Error('kind')
    const lulls = ours.events.filter((e) => e.kind === 'minFlood' || e.kind === 'minEbb')
    expect(lulls.length).toBeGreaterThan(0)
    const covering = { start: lulls[0].time, hours: 1 }
    const spliced = spliceReadings(ours, {
      kind: 'current',
      start: new Date(covering.start.getTime() - 1800_000),
      hours: covering.hours,
      samples: [0, 1, 2].map((i) => ({ time: new Date(covering.start.getTime() - 1800_000 + i * 1800_000), level: 0.2 })),
      events: [],
    })
    if (spliced.kind !== 'current') throw new Error('kind')
    expect(spliced.events.map((e) => +e.time)).not.toContain(+lulls[0].time)
    expect(spliced.events.length).toBe(ours.events.length - 1)
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
