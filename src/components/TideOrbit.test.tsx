import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TideOrbit, tideOrbitGeometry } from './TideOrbit'

describe('TideOrbit', () => {
  it('reveals the shared orbit and the far-side bulge without hiding the controls', () => {
    const shortcut = tideOrbitGeometry(0)
    const shared = tideOrbitGeometry(1)

    expect(shortcut.earthX).toBe(0)
    expect(shortcut.farBulge).toBe(0)
    expect(shared.earthX).toBeLessThan(0)
    expect(shared.farBulge).toBe(shared.nearBulge)

    const html = renderToStaticMarkup(<TideOrbit />)
    expect(html).toContain('type="range"')
    expect(html).toContain('Reveal the shared orbit')
    expect(html).toContain('Pause motion')
  })
})
