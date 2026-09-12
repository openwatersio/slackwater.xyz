import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteSky } from './SiteSky'
import { stylizedSky } from '#/lib/site-sky'

it('is decorative and keeps its canvas out of layout', () => {
  const html = renderToStaticMarkup(<SiteSky frame={stylizedSky('night')} />)
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('<canvas')
  expect(html).toContain('pointer-events-none')
})
