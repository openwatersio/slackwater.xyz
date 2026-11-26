import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FindWater } from './FindWater'

it('offers explicit location and station search without requesting either on render', () => {
  const html = renderToStaticMarkup(<FindWater />)
  expect(html).toContain('Use my location')
  expect(html).toContain('Search station names')
  expect(html).toContain('Location stays on your device')
  expect(html).not.toContain('Loading stations')
})
