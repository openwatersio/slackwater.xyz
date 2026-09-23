import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  EarthWobbleAnimation,
  MoonPullAnimation,
  TideOrbit,
  tideOrbitGeometry,
} from './TideOrbit'

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
    expect(html).toContain('value="100"')
    expect(html).toContain('Reveal the shared orbit')
    expect(html).toContain('Pause motion')
  })

  it('introduces the pull and the wobble as separate animations', () => {
    const pull = renderToStaticMarkup(<MoonPullAnimation />)
    const wobble = renderToStaticMarkup(<EarthWobbleAnimation />)

    expect(pull).toContain('The Moon pulling the nearest water')
    expect(pull).not.toContain('Barycentre')
    expect(wobble).toContain('Earth orbiting an off-centre barycentre')
    expect(wobble).toContain('Barycentre')
    expect(wobble).not.toContain('type="range"')
  })
})
