import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteFooter } from './SiteFooter'
import { APP_STORE_REVIEW } from '../lib/links'
import { COMPARE_PAGES } from '../lib/compare'

describe('shared site footer', () => {
  const html = renderToStaticMarkup(<SiteFooter />)

  it('groups every footer destination under a useful navigation heading', () => {
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)![0]
    const APP_SOURCE = 'https://github.com/openwatersio/slackwater-ios'
    const groups = {
      Explore: ['/stations/', '/learn/tides/', '/learn/slack-water/'],
      'The app': ['/pricing/', '/about/'],
      Compare: ['/compare/slackwater-vs-tide-alert/', '/compare/best-tide-and-current-apps-iphone/'],
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

  it('links only to comparison pages that exist', () => {
    const compare = [...html.matchAll(/<section[ >][\s\S]*?<\/section>/g)].find(([m]) => m.includes('>Compare</h2>'))![0]
    const hrefs = [...compare.matchAll(/href="([^"]+)"/g)].map(([, href]) => href)
    expect(hrefs.length).toBeGreaterThan(1)
    for (const href of hrefs) expect(COMPARE_PAGES, href).toHaveProperty([href])
  })

  it('asks for a rating and points to the other ways to help', () => {
    expect(html).toContain(`href="${APP_STORE_REVIEW}"`)
    expect(html).toContain('href="/support/#help"')
  })

})
