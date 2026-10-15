import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteFooter } from './SiteFooter'

describe('shared site footer', () => {
  const html = renderToStaticMarkup(<SiteFooter />)

  it('groups every footer destination under a useful navigation heading', () => {
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)![0]
    const APP_SOURCE = 'https://github.com/openwatersio/slackwater-ios'
    const groups = {
      Explore: ['/stations/', '/learn/tides/', '/learn/slack-water/'],
      'The app': ['/pricing/', '/compare/best-tide-and-current-apps-iphone/', '/about/'],
      Help: ['/support/', '/contact/', '/privacy/'],
      'Tools &amp; code': ['/opencpn/', APP_SOURCE, 'https://openwaters.io/tides/slackwater/'],
    }
    for (const [heading, destinations] of Object.entries(groups)) {
      const section = [...footer.matchAll(/<section[ >][\s\S]*?<\/section>/g)].find(([markup]) => markup.includes(`>${heading}</h2>`))?.[0]
      expect(section, heading).toBeDefined()
      for (const href of destinations) expect(section, heading).toContain(`href="${href}"`)
    }
    expect(footer).toContain('aria-label="Footer"')
    expect(footer).toContain('Not for navigation.')
    expect(footer).toContain('href="https://openwaters.io"')
  })

})
