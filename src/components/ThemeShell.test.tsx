import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeShell, locationAppearance } from './ThemeShell'

it('renders the orbital button and four labelled modes', () => {
  const html = renderToStaticMarkup(<ThemeShell matches={[]}><p>Water</p></ThemeShell>)
  expect(html).toContain('Theme: Night')
  expect(html).toContain('Auto (system)')
  expect(html).toContain('Light')
  expect(html).toContain('Night')
  expect(html).toContain('Location')
  expect(html).toContain('popover')
  expect(html).toContain('Water')
})

it('starts at night on the server even for a station route', () => {
  const html = renderToStaticMarkup(
    <ThemeShell matches={[{ loaderData: { station: { latitude: 48.5, longitude: -123.1 } } }]}>
      <p>Water</p>
    </ThemeShell>,
  )
  expect(html).toContain('Theme: Night')
  expect(html).toContain('☾')
  expect(html).not.toContain('☀︎')
})

it('resolves Location appearance from solar altitude, not body visibility', () => {
  const seattle = { latitude: 47.6026, longitude: -122.3393 }
  expect(locationAppearance(seattle, new Date('2026-09-12T17:06:00Z'))).toBe('light')
  expect(locationAppearance(seattle, new Date('2026-09-12T07:00:00Z'))).toBe('night')
})
