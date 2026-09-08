import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { CurrentLead } from './CurrentLead'

const AT = new Date('2026-09-08T14:42:00Z')
const TZ = 'America/Los_Angeles'
const render = (level: number, slack = false) =>
  renderToStaticMarkup(
    <CurrentLead level={level} setDegrees={290} slack={slack} at={AT} timeZone={TZ} />,
  )

describe('CurrentLead', () => {
  it('leads with the state and the set, the way the app does', () => {
    const html = render(-3.1)
    expect(html).toContain('Ebbing')
    expect(html).toContain('WNW')
    expect(html).toContain('rotate(290deg)')
  })

  it('shows the speed unsigned, to one decimal, with its unit beside it', () => {
    const html = render(-3.14)
    expect(html).toContain('3.1')
    expect(html).not.toContain('-3.1')
    expect(html).toContain('kn')
  })

  it('sets the reading in the rounded face with tabular digits', () => {
    const html = render(3.1)
    expect(html).toContain('font-rounded')
    expect(html).toContain('tabular-nums')
  })

  it('reads the time the way the app reads it', () => {
    expect(render(3.1)).toContain('7:42am')
  })

  it('tints by phase, and green is slack alone', () => {
    expect(render(3.1)).toContain('text-sw-flood')
    expect(render(-3.1)).toContain('text-sw-ebb')
    expect(render(3.1)).not.toContain('text-sw-go')
    expect(render(0.2, true)).toContain('text-sw-go')
  })

  it('points both ways at slack, because the water does', () => {
    const html = render(0.2, true)
    expect(html).toContain('Slack')
    expect(html).not.toContain('WNW')
  })

  it('imports nothing the landing page owns', () => {
    const source = readFileSync(new URL('./CurrentLead.tsx', import.meta.url), 'utf8')
    for (const forbidden of ['HERO_STATION', 'TESTFLIGHT', 'use-scrub-intro', 'ScrubHero']) {
      expect(source).not.toContain(forbidden)
    }
  })
})
