import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { Route as RootRoute } from './__root'
import { Route } from './index'
import { TESTFLIGHT } from '#/lib/links'

// The page is screenshots around one call to action, so those are the two
// things that can silently break it: a shot renamed out from under an <img>,
// or the CTA pointing somewhere other than the public beta.
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

  it('points the call to action at the public beta', () => {
    expect(html).toContain(`href="${TESTFLIGHT}"`)
  })

  it('computes nothing in the page', () => {
    // Icons are SVG too; a curve is the only SVG that would mean a prediction ran.
    const withoutIcons = html.replace(/<svg aria-hidden[^>]*>[\s\S]*?<\/svg>/g, '')
    expect(withoutIcons).not.toContain('<svg')
  })
})

describe('landing page social card', () => {
  it('says what the app is in one line', async () => {
    const head = await RootRoute.options.head?.({} as never)
    expect(head?.meta).toContainEqual({
      property: 'og:title',
      content: 'A free tides & currents app that works offline.',
    })
  })
})
