import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TidesExplainerCard } from './TidesExplainerCard'

it('links its explanation to the tides guide', () => {
  const html = renderToStaticMarkup(<TidesExplainerCard />)

  expect(html).toContain('href="/learn/tides/"')
  expect(html).toContain('Why does the Moon make two high tides?')
  expect(html).toContain('Learn how tides work')
})
