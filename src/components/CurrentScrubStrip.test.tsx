import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CurrentScrubStrip } from './CurrentScrubStrip'
import { skyDays } from '#/lib/sky-state'
import { HERO_STATION } from '#/lib/currents'

const FROM = new Date('2026-09-08T09:38:00Z')
const TO = new Date('2026-09-08T15:38:00Z')
const days = skyDays(HERO_STATION.latitude, HERO_STATION.longitude, FROM, TO)

// A server render has no layout, so the strip draws in FALLBACK_BOX here.
const render = (scrubTime: Date) =>
  renderToStaticMarkup(
    <CurrentScrubStrip
      station={HERO_STATION} days={days} from={FROM} to={TO}
      scrubTime={scrubTime} seconds={0} live={false}
    />,
  )

describe('CurrentScrubStrip', () => {
  it('draws a real path from the station it was given', () => {
    expect(render(FROM)).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
  })

  it('pans the curve so the scrub sits under the centerline', () => {
    const at = (html: string) => Number(html.match(/translate\((-?[\d.]+) 0\)/)![1])
    expect(at(render(FROM))).toBeGreaterThan(at(render(TO)))
  })

  it('paints the curve from a theme token, not a literal hex', () => {
    expect(render(FROM)).toContain('var(--color-sw-foam)')
  })

  it('fills from the app’s graph ink, clear at slack and intensifying outward', () => {
    const html = render(FROM)
    expect(html).toContain('var(--color-sw-graph-line)')
    // Three stops: strong, clear at the midline, strong again.
    expect(html).toMatch(/stop-opacity="0\.5"[\s\S]*stop-opacity="0"[\s\S]*stop-opacity="0\.5"/)
  })

  it('needs no clip, because one gradient spans the whole plot', () => {
    expect(render(FROM)).not.toContain('clip-path')
  })

  it('no longer paints the fill with the speed ramp', () => {
    // The ramp moved to the stroke in the app; a fill in ramp yellow is the old arrangement.
    expect(render(FROM)).not.toContain('#f5c96b')
  })

  it('imports nothing the landing page owns', () => {
    const source = readFileSync(new URL('./CurrentScrubStrip.tsx', import.meta.url), 'utf8')
    for (const forbidden of ['HERO_STATION', 'TESTFLIGHT', 'use-scrub-intro', 'ScrubHero']) {
      expect(source).not.toContain(forbidden)
    }
  })

  it('gives two instances their own gradient ids', () => {
    const both = renderToStaticMarkup(
      <>
        <CurrentScrubStrip station={HERO_STATION} days={days} from={FROM} to={TO} scrubTime={FROM} seconds={0} live={false} />
        <CurrentScrubStrip station={HERO_STATION} days={days} from={FROM} to={TO} scrubTime={FROM} seconds={0} live={false} />
      </>,
    )
    const ids = [...both.matchAll(/id="fill-([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('names its own station for a reader who cannot see it', () => {
    expect(render(FROM)).toContain('Deception Pass (Narrows)')
  })

  it('sizes the prerendered sky to the section, not to the fallback box', () => {
    // Before measurement the fallback box is 620px tall inside a 100dvh section;
    // a fixed pixel height there leaves a band of bare page under the sky.
    expect(render(FROM)).toContain('height:calc(100% - 124px)')
  })

  it('shows the set, which the reading is incomplete without', () => {
    const live = renderToStaticMarkup(
      <CurrentScrubStrip
        station={HERO_STATION} days={days} from={FROM} to={TO}
        scrubTime={FROM} seconds={0} live
      />,
    )
    expect(live).toContain('rotate(')
    // The station's own set, not a loose alternation: the station name contains an N.
    expect(live).toMatch(/>(ESE|WNW)</)
  })

  it('still says nothing about the present when it has no live clock', () => {
    expect(render(FROM)).not.toMatch(/\d{1,2}:\d{2}/)
    expect(render(FROM)).not.toMatch(/Ebbing|Flooding|Slack/i)
  })
})
