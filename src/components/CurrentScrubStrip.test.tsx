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
      scrubTime={scrubTime} seconds={0}
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

  it('paints with attributes, not classes, so a rasteriser can render it', () => {
    expect(render(FROM)).toMatch(/(fill|stroke)="#[0-9A-Fa-f]{6}"/)
  })

  it('clips the fill in screen space, not in the panning curve’s space', () => {
    // A clipPath referenced from inside the translated group pans with it and
    // shears the fill off the trailing edge — invisible to a transform assertion.
    expect(render(TO)).toMatch(/<g clip-path="url\(#above-[^)]+\)"><g transform="translate/)
  })

  it('knows nothing about the landing page', () => {
    // The boundary the station pages depend on: no pill, no download, no intro.
    const html = render(FROM)
    expect(html).not.toMatch(/TestFlight|Slackwater|beta/i)
  })

  it('names its own station for a reader who cannot see it', () => {
    expect(render(FROM)).toContain('Deception Pass (Narrows)')
  })
})
