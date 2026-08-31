import { describe, expect, it } from 'vitest'
import { predictSeries, findEvents, slackWindows, SLACK_KNOTS } from './predict'
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
  // Feet: the catalogue converts the database's metres once, at the boundary.
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
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

describe('slackWindows', () => {
  const start = new Date('2026-09-01T00:00:00Z')
  const windows = slackWindows(CURRENT, start, 24)

  it('opens and closes exactly where the curve meets the threshold', () => {
    expect(windows.length).toBeGreaterThan(0)
    // The endpoints are interpolated crossings, not the nearest 10-minute
    // sample: at a fast gate a sample lands a long way from the edge.
    for (const w of windows) {
      for (const edge of [w.start, w.end]) {
        // Fidelity 1, not the default: the timeline snaps to a 10-minute grid,
        // which is the very error the interpolation exists to remove.
        const at = predictSeries(CURRENT, edge, 1 / 3600, 1)[0].level
        expect(Math.abs(at)).toBeCloseTo(SLACK_KNOTS, 2)
      }
    }
  })

  it('wraps each slack, one window per reversal', () => {
    const slacks = findEvents(CURRENT, start, 24)
      .filter((e) => e.kind === 'slack')
      .map((e) => e.time.getTime())
    expect(windows.length).toBe(slacks.length)
    for (const w of windows) {
      const inside = slacks.filter((t) => t >= w.start.getTime() && t <= w.end.getTime())
      expect(inside.length).toBe(1)
    }
  })

  it('is not fooled by a lull that never reverses', () => {
    // Bias the whole day just above zero, so the curve dips well inside the
    // threshold and builds back the way it came. That is weak water, not
    // slack — drawing it green promises a transit that never opens.
    const levels = predictSeries(CURRENT, start, 24).map((s) => s.level)
    const lull = { ...CURRENT, offset: -Math.min(...levels) + 0.2 }
    expect(Math.min(...predictSeries(lull, start, 24).map((s) => s.level))).toBeCloseTo(0.2, 6)
    expect(slackWindows(lull, start, 24)).toEqual([])
  })
})
