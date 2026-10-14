import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { loadCatalogue } from './catalogue'
import { dayStart } from './format'
import { findEvents, tideExtremes } from './predict'
import { GUIDE_DAYS, slackGuide } from './slack-guide'
import type { BundledStation } from './station'
import { SlackWaterGuide } from '#/components/SlackWaterGuide'

const catalogue = loadCatalogue()
const get = (kind: string, slug: string) =>
  catalogue.find((s) => s.kind === kind && s.slug === slug) as BundledStation
const pass = get('current', 'deception-pass-narrows')
const gauge = get('tide', 'deception-pass-state-park')
const goldenGate = get('current', 'golden-gate-bridge-0-46-nm-e-of')
const now = new Date('2026-10-15T19:00:00Z')
const guide = slackGuide({ current: pass, tide: gauge, durations: [pass, goldenGate] }, now)

describe('slack against the tide at Deception Pass', () => {
  const { day, fortnight } = guide.comparison

  it('uses a gauge with its own harmonics, beside the pass', () => {
    // A subordinate gauge would carry its reference's constituents, and its
    // highs and lows would be another port's (#185).
    expect(gauge.reduction).toBeUndefined()
    expect(guide.comparison.distanceNm).toBeLessThan(1)
  })

  it('calls out a slack an hour or more from the nearest high or low', () => {
    const { slack, extreme } = day.callout
    expect(Math.abs(extreme - slack)).toBeGreaterThanOrEqual(3600_000)
    // The extreme is genuinely the gauge's nearest.
    const extremes = tideExtremes(gauge, new Date(slack - 12 * 3600_000), 24)
    const nearest = Math.min(...extremes.map((e) => Math.abs(+e.time - slack)))
    // The solver's answer moves by milliseconds with its search window.
    expect(Math.abs(Math.abs(extreme - slack) - nearest)).toBeLessThan(60_000)
  })

  it('counts every slack in the fortnight', () => {
    const slacks = findEvents(pass, dayStart(now, pass.timezone), GUIDE_DAYS * 24).filter((e) => e.kind === 'slack')
    expect(fortnight.slacks).toBe(slacks.length)
    expect(fortnight.within30 + fortnight.overHour).toBeLessThanOrEqual(fortnight.slacks)
    expect(fortnight.overHour).toBeGreaterThan(0)
  })

  it('draws one local day', () => {
    expect(day.end - day.start).toBeGreaterThanOrEqual(23 * 3600_000)
    expect(day.current.length).toBeGreaterThan(100)
    expect(day.tide.length).toBe(day.current.length)
    expect(day.slacks).toContain(day.callout.slack)
  })
})

describe('slack durations', () => {
  const [dp, gg] = guide.durations

  it('orders each station’s runs', () => {
    for (const row of guide.durations) {
      expect(row.windows).toBeGreaterThan(GUIDE_DAYS)
      expect(row.shortest.minutes).toBeLessThanOrEqual(row.medianMinutes)
      expect(row.medianMinutes).toBeLessThanOrEqual(row.longest.minutes)
    }
  })

  it('drops runs clamped by the frame edge', () => {
    // A clamped run would read as a few minutes of slack that never happened.
    expect(dp.shortest.minutes).toBeGreaterThan(30)
  })

  it('shows a fast narrow pass barely pausing next to a broad channel', () => {
    expect(dp.peakKnots).toBeGreaterThan(gg.peakKnots)
    expect(dp.medianMinutes).toBeLessThan(gg.medianMinutes)
  })
})

describe('the slack water guide', () => {
  const html = renderToStaticMarkup(createElement(SlackWaterGuide, { guide }))

  it('answers the question in its first paragraph', () => {
    const first = html.match(/<p class="mt-6[^"]*">([\s\S]*?)<\/p>/)![1]
    expect(first).toMatch(/^Slack water is the short stretch of time when a tidal current turns around/)
  })

  it('states the band the charts use', () => {
    expect(html).toContain(`under ${guide.slackKnots} knots`)
  })

  it('links the stations its numbers come from and the app', () => {
    expect(html).toContain(`href="${pass.path}"`)
    expect(html).toContain(`href="${gauge.path}"`)
    expect(html).toContain(`href="${goldenGate.path}"`)
    expect(html).toContain('href="https://apps.apple.com/app/slackwater-tides-current/id6813654837"')
  })
})
