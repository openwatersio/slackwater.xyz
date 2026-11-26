import { describe, expect, it } from 'vitest'
import { fortnightWindow, outlookWindow, rangeTile, swingHeights } from '@slackwater/react'
import { fortnightOf, rankedAround, splicedExtremes } from './StationTiles'
import { tideExtremes } from '#/lib/predict'
import { extreme } from '#/lib/readings'
import type { BundledStation } from '#/lib/station'

const seattle: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'Seattle',
  path: '/tides/us/wa/seattle/',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled', chartDatum: 'MLLW',
  constituents: [
    { name: 'M2', amplitude: 3.487, phase: 10.8 },
    { name: 'S2', amplitude: 0.85, phase: 40 },
    { name: 'K1', amplitude: 2.625, phase: 300 },
  ],
}
const DAY = 86_400_000
const tz = seattle.timezone

describe('rankedAround', () => {
  const opened = Date.parse('2026-09-11T20:00:00Z')

  it('starts on the first moment, and has none before it', () => {
    expect(rankedAround(undefined, undefined, tz)).toBeUndefined()
    expect(rankedAround(undefined, opened, tz)).toBe(opened)
  })

  it('holds while the moment stays in the month around it', () => {
    expect(rankedAround(opened, opened + 7 * DAY, tz)).toBe(opened)
    expect(rankedAround(opened, opened - 7 * DAY, tz)).toBe(opened)
    expect(rankedAround(opened, undefined, tz)).toBe(opened)
  })

  it('starts again on a moment outside it: Now from a far shared link, or a page open for weeks', () => {
    const today = Date.parse('2027-06-24T19:00:00Z')
    expect(rankedAround(opened, today, tz)).toBe(today)
    const window = fortnightWindow(opened, tz)
    expect(rankedAround(opened, Date.parse(window.end), tz)).toBe(Date.parse(window.end))
    expect(rankedAround(opened, Date.parse(window.start), tz)).toBe(opened)
  })
})

describe('fortnightOf', () => {
  it("ranks a tide's swing among the month's computed swings", () => {
    const around = Date.parse('2026-09-11T20:00:00Z')
    const fortnight = fortnightOf(seattle, around)
    expect(fortnight.kind).toBe('tide')
    const window = fortnightWindow(around, tz)
    const turns = tideExtremes(seattle, new Date(window.start), (Date.parse(window.end) - Date.parse(window.start)) / 3600_000).map(extreme)
    expect(fortnight.kind === 'tide' && fortnight.swings).toEqual(swingHeights(turns))
    // The month's biggest swing reads as the biggest, with its mark.
    const swings = turns.slice(1).map((t, i) => ({ at: t.time.getTime() - 60_000, size: Math.abs(t.level - turns[i].level) }))
    const biggest = swings.reduce((a, b) => (b.size > a.size ? b : a))
    const tile = rangeTile(turns, biggest.at, fortnight.kind === 'tide' ? fortnight.swings : undefined, 'feet', 'en-US')
    expect(tile).toMatchObject({ caption: "the fortnight's biggest", marked: true })
  })

  it("ranks a merged port's swing among swings that include the strip's own", () => {
    // A strip day whose swing is a foot wider than any computed one, as CHS's
    // can be: ranked against the computed month alone it would be the biggest.
    const around = Date.parse('2026-09-11T20:00:00Z')
    const window = fortnightWindow(around, tz)
    const all = tideExtremes(seattle, new Date(window.start), (Date.parse(window.end) - Date.parse(window.start)) / 3600_000).map(extreme)
    const from = around - 6 * 3600_000
    const to = around + 18 * 3600_000
    const strip = all.filter((t) => t.time.getTime() >= from && t.time.getTime() <= to).map((t) => ({ ...t, level: t.high ? t.level + 1 : t.level }))
    const spliced = fortnightOf(seattle, around, { from, to, extremes: strip })
    const computed = fortnightOf(seattle, around)
    expect(spliced.kind === 'tide' && spliced.swings).not.toEqual(computed.kind === 'tide' && computed.swings)
    expect(Math.max(...(spliced.kind === 'tide' ? spliced.swings : []))).toBeGreaterThan(Math.max(...(computed.kind === 'tide' ? computed.swings : [])))
  })

  it("ranks a current's maxima without computing its lulls", () => {
    const pass: BundledStation = {
      ...seattle, id: 'noaa/PUG1701', kind: 'current', floodDirection: 101.5, ebbDirection: 281.5,
    }
    const fortnight = fortnightOf(pass, Date.parse('2026-09-11T20:00:00Z'))
    expect(fortnight.kind === 'current' && fortnight.events.some((e) => e.kind === 'maxFlood')).toBe(true)
    expect(fortnight.kind === 'current' && fortnight.events.filter((e) => e.kind === 'minFlood' || e.kind === 'minEbb')).toEqual([])
  })
})

describe('splicedExtremes', () => {
  const week = Date.parse('2026-09-11T07:00:00Z')
  const window = outlookWindow(week, tz)
  const start = new Date(window.start)
  const hours = (Date.parse(window.end) - start.getTime()) / 3600_000
  const computed = tideExtremes(seattle, start, hours).map(extreme)
  const from = week + DAY
  const to = week + 2 * DAY
  const at = (t: { time: Date }) => t.time.getTime()

  it("is the computed turns where there is no strip", () => {
    expect(splicedExtremes(seattle, window)).toEqual(computed)
  })

  it("puts the strip's own turns in place over the hours the strip covers", () => {
    // A strip whose day's turns were raised a foot, as a merged port's CHS day can be.
    const strip = computed.filter((t) => at(t) >= from && at(t) <= to).map((t) => ({ ...t, level: t.level + 1 }))
    const out = splicedExtremes(seattle, window, { from, to, extremes: strip })
    expect(out).toHaveLength(computed.length)
    for (const t of out) {
      const original = computed.find((c) => at(c) === at(t))!
      expect(t.level).toBe(at(t) >= from && at(t) <= to ? original.level + 1 : original.level)
    }
    expect(out.map(at)).toEqual(out.map(at).sort((a, b) => a - b))
  })

  it('keeps no computed twin the strip moved, even past its last turn', () => {
    // The strip's day ends half an hour after its last turn, whose computed
    // twin lies between the two, as a DFO turn can sit ahead of its twin.
    const inside = computed.filter((t) => at(t) >= from && at(t) <= to)
    const last = inside[inside.length - 1]
    const strip = inside.map((t) => (t === last ? { ...t, time: new Date(at(t) - 30 * 60_000) } : t))
    const out = splicedExtremes(seattle, window, { from, to: at(last) + 30 * 60_000, extremes: strip })
    expect(out.filter((t) => at(t) === at(last))).toEqual([])
    expect(out.filter((t) => at(t) >= from && at(t) <= at(last) + 30 * 60_000)).toEqual(strip)
  })
})
