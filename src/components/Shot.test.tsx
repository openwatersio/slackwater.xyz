import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Shot } from './Shot'

it('crops and fades the image without fading its caption', () => {
  const html = renderToStaticMarkup(
    <Shot src="/shot.webp" alt="A tide screen" caption="Friday Harbor" crop />,
  )

  expect(html).toMatch(/mask-image:linear-gradient[\s\S]*<img[^>]*\/><\/div><figcaption/)
})
