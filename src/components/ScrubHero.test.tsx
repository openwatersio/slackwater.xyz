import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScrubHero } from './ScrubHero'

const html = renderToStaticMarkup(<ScrubHero />)

describe('ScrubHero', () => {
  it('makes no claim about a clock before it has a real one', () => {
    // The server render freezes at SERVER_NOW; a time in this HTML is stale by
    // however long ago the site was built.
    expect(html).not.toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/)
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
})
