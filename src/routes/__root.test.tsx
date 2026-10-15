import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RootDocument as Shell } from './__root'
import { Route as HomeRoute } from './index'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  HeadContent: () => null,
  Scripts: () => null,
}))

describe('site document', () => {
  it('ends every page with one shared navigation footer', () => {
    const html = renderToStaticMarkup(<Shell><main>Page content</main></Shell>)
    expect(html.match(/<footer[ >]/g)).toHaveLength(1)
    expect(html).toContain('aria-label="Footer"')
    expect(html).toContain('Not for navigation.')
    expect(html.indexOf('</main>')).toBeLessThan(html.indexOf('<footer'))
  })

  it('does not duplicate the shared footer on the homepage', () => {
    const Home = HomeRoute.options.component!
    const html = renderToStaticMarkup(<Shell><Home /></Shell>)
    expect(html.match(/aria-label="Footer"/g)).toHaveLength(1)
    expect(html.match(/<footer[ >]/g)).toHaveLength(1)
  })
})
