import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Route } from './privacy'

it('reserves mobile navigation space for the fixed appearance control', () => {
  const Privacy = Route.options.component!
  const html = renderToStaticMarkup(<Privacy />)
  const nav = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/)![0]

  expect(nav).toContain('href="/privacy.md"')
  expect(nav).toMatch(/class="[^"]*\bpe-14\b/)
  expect(nav).toContain('sm:pe-0')
})
