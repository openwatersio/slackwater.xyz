import { existsSync, readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Route } from './pricing'
import { APP_STORE } from '#/lib/links'

describe('Premium pricing page', () => {
  const Pricing = Route.options.component!
  const html = renderToStaticMarkup(<Pricing />)
  const markdown = readFileSync('src/content/pricing.md', 'utf8')

  it('presents one Premium feature set with two ways to pay', () => {
    expect(html).toContain('One Premium. Two ways to pay.')
    expect(markdown).toContain('](/pricing/#payment)')
    expect(markdown).toContain('same Premium features')
    expect(markdown).toContain('future Premium improvements')
    expect(html).toContain('US$7.99 per year')
    expect(html).toContain('US$69.99 once')
    expect(html).toContain('No subscription')
    expect(html).toContain('renews automatically')
    expect(html).not.toMatch(/<h2[^>]*>Premium (yearly|lifetime)/i)
  })

  it('states the price commitment alongside ongoing improvements', () => {
    expect(html).toContain('These prices stay the same as Premium grows.')
    expect(markdown).toContain('These prices stay the same as Premium grows.')
    expect(markdown).not.toContain('may change')
    expect(markdown).toContain('while your subscription is active')
  })

  it('shows three genuine app captures with alternatives in the Markdown', () => {
    const shots = [...html.matchAll(/<img[^>]+src="(\/shots\/premium\/[^" ]+)"[^>]+alt="([^"]+)"/g)]
    expect(shots).toHaveLength(3)
    for (const [, src, alt] of shots) {
      expect(existsSync(`public${src}`), src).toBe(true)
      expect(alt.length).toBeGreaterThan(30)
      expect(markdown).toContain(`](${src})`)
    }
    expect(html).toContain('Examples captured from Slackwater')
  })

  it('keeps purchase instructions, local pricing and the free app clear', () => {
    expect(html).toContain(`href="${APP_STORE}"`)
    expect(html).toContain('Support Slackwater')
    expect(html).toContain('local currency')
    expect(html).toContain('The free app stays free')
    expect(html).toContain('Not for navigation.')
    expect(html).toContain('href="/pricing.md"')
  })
})
