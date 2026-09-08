import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScrubHero } from './ScrubHero'

const html = renderToStaticMarkup(<ScrubHero />)

describe('ScrubHero', () => {
  it('makes no claim about the present before it has a real clock', () => {
    // The server render freezes at SERVER_NOW, so any reading in this HTML is
    // stale by however long ago the site was built.
    expect(html).not.toMatch(/\d{1,2}:\d{2}/)
    expect(html).not.toMatch(/Ebbing|Flooding|Slack in/i)
    expect(html).not.toMatch(/\d+\.\d+<\/p>|kn<\/span>/)
  })

  it('carries the page’s only heading, and the wordmark does not break', () => {
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Slackwater')
    expect(html).toMatch(/whitespace-nowrap[^>]*>\s*Slackwater/)
  })

  it('offers the download', () => {
    expect(html).toMatch(/TestFlight|opening soon/)
  })

  it('keeps the station’s name attached to the water it describes', () => {
    expect(html).toContain('Deception Pass (Narrows)')
    expect(html).toContain('/currents/deception-pass-narrows/')
  })

  it('fills the viewport with a dynamic unit, not a static one', () => {
    expect(html).toContain('100dvh')
  })

  it('gives the pill the app’s card corner and hairline', () => {
    expect(html).toContain('rounded-3xl')
    expect(html).toContain('border-sw-card-stroke')
  })

  it('leaves the clock to the readout, where the app puts it', () => {
    // The caption keeps the station and the claim; the time belongs to the lead card.
    expect(html).toContain('computed in this browser')
    expect(html).not.toMatch(/\d{1,2}:\d{2}/)
  })
})
