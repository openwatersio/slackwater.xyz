import { describe, expect, it } from 'vitest'
import { HERO_STATION } from './currents'
import { findEvents, nextEvent, predictSeries } from './predict'

// A fixed UTC day so this never depends on when it runs.
const START = new Date('2026-08-21T00:00:00Z')

describe('hero station currents', () => {
  it('is Deception Pass, and floods east / ebbs west', () => {
    expect(HERO_STATION.name).toBe('Deception Pass (Narrows)')
    expect(HERO_STATION.floodDirection).toBeCloseTo(101.5, 1)
    expect(HERO_STATION.ebbDirection).toBeCloseTo(281.5, 1)
  })

  it('predicts a curve that actually moves, without a staircase', () => {
    const s = predictSeries(HERO_STATION, START, 24)
    expect(s.length).toBeGreaterThan(100)

    // getWaterLevelAtTime snaps to a ~10-minute grid; sampling it in a loop
    // yields runs of identical values that then read as turning points. If
    // this drops, someone has gone back to per-sample calls.
    const distinct = new Set(s.map((x) => x.level)).size
    expect(distinct).toBeGreaterThan(s.length * 0.95)
    const speeds = s.map((x) => Math.abs(x.level))
    // Deception Pass runs hard — if this ever reads like a lake, the
    // constituents or the offset got lost somewhere.
    expect(Math.max(...speeds)).toBeGreaterThan(3)
    expect(Math.max(...speeds)).toBeLessThan(16)
  })

  it('finds slack at the zero crossings and extremes between them', () => {
    const events = findEvents(HERO_STATION, START, 24)
    expect(events.length).toBeGreaterThanOrEqual(6)
    // A real day here is a handful of turns, not one every ten minutes.
    expect(events.length).toBeLessThan(20)

    // Slack means slack: the curve really is at zero there.
    for (const e of events.filter((x) => x.kind === 'slack')) {
      expect(Math.abs(e.level)).toBeLessThan(0.001)
    }
    // Flood is signed positive, ebb negative — one axis, not two colours.
    for (const e of events.filter((x) => x.kind === 'flood')) expect(e.level).toBeGreaterThan(0)
    for (const e of events.filter((x) => x.kind === 'ebb')) expect(e.level).toBeLessThan(0)

    // Events are in time order.
    const times = events.map((e) => e.time.getTime())
    expect([...times].sort((a, b) => a - b)).toEqual(times)

    // Between two slacks the sign cannot change, so every extreme in that span
    // is the same kind. (Not "slack, extreme, slack, extreme" — the water does
    // run twice in one direction without reversing, and this day does exactly
    // that: a -4.8 kn local maximum between two deeper ebbs.)
    let span: typeof events = []
    const spans: (typeof events)[] = []
    for (const e of events) {
      if (e.kind === 'slack') { spans.push(span); span = [] } else span.push(e)
    }
    spans.push(span)
    for (const s of spans) {
      const kinds = new Set(s.map((e) => e.kind))
      expect(kinds.size).toBeLessThanOrEqual(1)
    }
  })

  it('nextEvent returns the first event at or after now', () => {
    const events = findEvents(HERO_STATION, START, 24)
    const mid = new Date(START.getTime() + 12 * 3600_000)
    const next = nextEvent(events, mid)
    expect(next).toBeDefined()
    expect(next!.time.getTime()).toBeGreaterThanOrEqual(mid.getTime())
  })
})
