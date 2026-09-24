import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  EarthWobbleAnimation,
  MoonPullAnimation,
  TideBlueprint,
  TideOrbit,
  earthMoonMeasurements,
  tideOrbitGeometry,
  wobbleGeometry,
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
    const centered = wobbleGeometry('center')
    const barycenter = wobbleGeometry('barycenter')

    expect(pull).toContain('The Moon pulling the nearest water')
    expect(pull).not.toContain('Barycenter')
    expect(centered.earthX).toBe(0)
    expect(centered.farBulge).toBe(0)
    expect(barycenter.earthX).toBeLessThan(0)
    expect(barycenter.farBulge).toBeGreaterThan(0)
    expect(wobble).toContain('>Center</button>')
    expect(wobble).toContain('>Barycenter</button>')
    expect(wobble).toContain('aria-pressed="true"')
    expect(wobble).not.toContain('Let Earth wobble')
    expect(wobble).not.toContain('type="range"')
  })

  it('derives the blueprint dimensions from the mean Earth–Moon system', () => {
    const measurements = earthMoonMeasurements()

    expect(measurements.earthToBarycenterKm).toBeCloseTo(4_671, 0)
    expect(measurements.earthToBarycenterKm + measurements.barycenterToMoonKm).toBe(
      measurements.earthToMoonKm,
    )
    expect(measurements.earthSpeedMps).toBeCloseTo(12.4, 1)

    const html = renderToStaticMarkup(<TideBlueprint />)
    expect(html).toContain('384,400 km')
    expect(html).toContain('4,671 km')
    expect(html).toContain('1.022 km/s')
  })
})
