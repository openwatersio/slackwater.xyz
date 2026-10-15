import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Route as RootRoute, SITE_DESCRIPTION, SITE_TITLE } from './__root'
import { Route } from './index'
import { APP_STORE } from '#/lib/links'
import { loadCatalogue } from '#/lib/catalogue'

// The page is screenshots around one call to action, so those are the two
// things that can silently break it: a shot renamed out from under an <img>,
// or the CTA pointing somewhere other than the App Store listing.
describe('landing page', () => {
  const Home = Route.options.component!
  const html = renderToStaticMarkup(<Home />)

  it('links every shot to a file that ships', () => {
    const srcs = [...html.matchAll(/src="(\/shots\/[^"]+)"/g)].map((m) => m[1])
    expect(srcs.length).toBeGreaterThan(0)
    for (const src of srcs) expect(existsSync(`public${src}`), src).toBe(true)
  })

  it('plays a one-shot hero recording only when motion is allowed', () => {
    const hero = html.match(/<video[\s\S]*?<\/video>/)?.[0]

    expect(hero).toContain('autoPlay=""')
    expect(hero).toContain('muted=""')
    expect(hero).toContain('playsInline=""')
    expect(hero).toContain('poster="/shots/tides-day.webp"')
    expect(hero).toContain('src="/shots/tides-day-to-night.mp4"')
    expect(hero).toContain('media="(prefers-reduced-motion: no-preference)"')
    expect(hero).toContain('src="/shots/tides-night.webp"')
    expect(hero).not.toContain('loop=""')
  })

  it('points the call to action at the App Store listing', () => {
    expect(APP_STORE).toBe('https://apps.apple.com/app/slackwater-tides-current/id6813654837')
    expect(html).toContain(`href="${APP_STORE}"`)
    expect(html).toContain('Download on the App Store')
    expect(html.match(/Requires iOS 26 or later\./g)).toHaveLength(2)
    expect(html).not.toMatch(/TestFlight|public beta|opening soon/i)
  })

  it('does not preload the hidden video fallback', () => {
    expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+href="\/shots\/tides-night.webp"/)
  })

  it('links the hero to the tides explainer', () => {
    const hero = html.match(/<header[\s\S]*?<\/header>/)?.[0]

    expect(hero).toContain('href="/learn/tides/"')
    expect(hero).toContain('Learn how tides work')
  })

  it('links the hero to the slack water guide', () => {
    const hero = html.match(/<header[\s\S]*?<\/header>/)?.[0]

    expect(hero).toContain('href="/learn/slack-water/"')
  })

  it('computes nothing in the page', () => {
    // Icons are SVG too; a curve is the only SVG that would mean a prediction ran.
    const withoutIcons = html.replace(/<svg aria-hidden[^>]*>[\s\S]*?<\/svg>/g, '')
    expect(withoutIcons).not.toContain('<svg')
  })

  it('states the station counts the site publishes', () => {
    // The footer's counts are typed, because the page computes nothing; this
    // fails when a database release changes the corpus and the footer doesn't.
    const all = loadCatalogue()
    for (const kind of ['tide', 'current'] as const) {
      const count = all.filter((s) => s.kind === kind).length.toLocaleString('en-US')
      expect(html).toContain(`${count} ${kind} stations`)
    }
  })
})

describe('landing page structured data', () => {
  const graph = async () => {
    const head = await Route.options.head?.({} as never)
    const block = head?.meta?.find((m) => m && 'script:ld+json' in m) as
      | { 'script:ld+json': { '@graph': Array<Record<string, unknown>> } }
      | undefined
    return block!['script:ld+json']['@graph']
  }
  const byType = (nodes: Array<Record<string, unknown>>, type: string) =>
    nodes.find((n) => n['@type'] === type)!

  it('links the app to its App Store listing and source', async () => {
    const app = byType(await graph(), 'MobileApplication')
    expect(app.installUrl).toBe(APP_STORE)
    expect(app.sameAs).toEqual([APP_STORE, 'https://github.com/openwatersio/slackwater-ios'])
  })

  it('names one publisher for the site and the app', async () => {
    const nodes = await graph()
    const org = byType(nodes, 'Organization')
    // The App Store seller line, exactly.
    expect(org.legalName).toBe('Open Water Software LLC')
    for (const type of ['WebSite', 'MobileApplication']) {
      expect(byType(nodes, type).publisher).toEqual({ '@id': org['@id'] })
    }
  })
  it('publishes the verified support contact on the organization', async () => {
    const org = byType(await graph(), 'Organization')
    expect(org.contactPoint).toEqual({
      '@type': 'ContactPoint', email: 'slackwater@openwaters.io',
      contactType: 'customer support', url: 'https://slackwater.xyz/contact/',
    })
  })

})

describe('landing page social card', () => {
  it('says what the app is in one line, brand first', async () => {
    const head = await RootRoute.options.head?.({} as never)
    const title = 'Slackwater — Free Offline Tide & Current App for iPhone'
    expect(head?.meta).toContainEqual({ title })
    expect(head?.meta).toContainEqual({ property: 'og:title', content: title })
  })

  it('offers the App Store banner on every page', async () => {
    const head = await RootRoute.options.head?.({} as never)
    expect(head?.meta).toContainEqual({ name: 'apple-itunes-app', content: 'app-id=6813654837' })
  })

  it('fits the title and description in a search result', () => {
    expect(SITE_TITLE.length).toBeLessThan(60)
    expect(SITE_DESCRIPTION.length).toBeLessThan(160)
  })
})
