import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { NearbyMap } from './NearbyMap'

const STATION = { name: 'Deception Pass (Narrows)', latitude: 48.4, longitude: -122.64 }
const ROWS = [
  { name: 'Bowman Bay', latitude: 48.41, longitude: -122.66, href: '/currents/bowman-bay/' },
  { name: 'Yokeko Point', latitude: 48.44, longitude: -122.62, href: '/currents/yokeko-point/' },
]

describe('NearbyMap', () => {
  const html = renderToStaticMarkup(<NearbyMap station={STATION} rows={ROWS} />)

  it('server-renders an empty box and nothing a crawler could mistake for content', () => {
    // The map is drawn by Leaflet after the box scrolls into view. On the
    // server there is no map: no tile images, no Leaflet DOM, no station
    // names. The sibling Nearby list is what a reader without JavaScript and
    // what a crawler both get, and it is already in the page.
    expect(html).not.toContain('<img')
    expect(html).not.toContain('leaflet')
    expect(html).not.toContain('Bowman Bay')
  })

  it('is decorative, and says so', () => {
    // Duplicating the Nearby list into the accessibility tree as unlabelled
    // markers would announce every station twice and navigate neither.
    expect(html).toContain('aria-hidden="true"')
  })

  it('never imports leaflet at module scope', () => {
    // Leaflet touches `window` when it is evaluated, so a static import here
    // throws during every one of the 3,640 prerenders — the whole build, not
    // one page. The import has to stay inside the effect.
    const src = readFileSync(new URL('./NearbyMap.tsx', import.meta.url), 'utf8')
    expect(src).not.toMatch(/^import\b[^\n]*'leaflet/m)
  })
})
