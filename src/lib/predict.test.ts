import { describe, expect, it } from 'vitest'
import { predictSeries, findEvents } from './predict'
import type { Station } from './station'

const CURRENT: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
}
const TIDE: Station = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  constituents: [{ name: 'M2', amplitude: 1.063, phase: 10.8 }, { name: 'K1', amplitude: 0.8, phase: 300 }],
}

describe('predictSeries', () => {
  it('predicts from the station it is given, not a module-level one', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    const a = predictSeries(CURRENT, start, 12)
    const b = predictSeries(TIDE, start, 12)
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBe(a.length)
    // Two different stations must not produce an identical curve. This is the
    // regression guard for the module-level predictor this replaces.
    expect(a.map((s) => s.level)).not.toEqual(b.map((s) => s.level))
  })

  it('is deterministic for one station', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    expect(predictSeries(TIDE, start, 6)).toEqual(predictSeries(TIDE, start, 6))
  })

  it('honours a station offset', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    const shifted = { ...CURRENT, offset: 1.5 }
    const base = predictSeries(CURRENT, start, 3)[0].level
    expect(predictSeries(shifted, start, 3)[0].level).toBeCloseTo(base + 1.5, 6)
  })
})

describe('findEvents', () => {
  const events = findEvents(CURRENT, new Date('2026-09-01T00:00:00Z'), 24)

  it('finds slack, which getExtremesPrediction does not supply', () => {
    // Slack is interpolated from sign changes between timeline samples. A
    // version built on extremes alone returns none — this is the assertion
    // that catches that rewrite.
    expect(events.filter((e) => e.kind === 'slack').length).toBeGreaterThan(0)
    expect(events.filter((e) => e.kind === 'slack').every((e) => e.level === 0)).toBe(true)
  })

  it('drops wrong-sign extremes rather than mislabelling them', () => {
    // A "high" that never reaches positive velocity is a weakest-ebb wiggle
    // mid-phase, not a flood. This filter is what keeps the site agreeing
    // with slackwater-web's noaaCurrentState.
    expect(events.filter((e) => e.kind === 'flood').every((e) => e.level > 0)).toBe(true)
    expect(events.filter((e) => e.kind === 'ebb').every((e) => e.level < 0)).toBe(true)
  })

  it('returns events in time order', () => {
    const times = events.map((e) => e.time.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})
