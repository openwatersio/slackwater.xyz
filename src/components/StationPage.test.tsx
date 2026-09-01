import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationPage } from './StationPage'
import type { ChsStation } from '#/lib/station'

const dodd = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.13546639419797, longitude: -123.81735084108287, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('StationPage for a CHS station', () => {
  const html = renderToStaticMarkup(
    <StationPage station={dodd} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('names the station', () => {
    expect(html).toContain('Dodd Narrows')
  })

  it('draws no curve', () => {
    expect(html).not.toContain('<svg')
  })

  it('claims no computation', () => {
    expect(html).not.toMatch(/comput/i)
  })

  it('does not claim the app works offline here', () => {
    // Nine of the 23 gates are never fitted on device, and nothing in the
    // published registry says which nine. Any offline claim is false for some
    // of them, so the page makes none.
    expect(html).not.toMatch(/offline/i)
  })

  it('still offers the app, which is why these pages exist', () => {
    expect(html).toMatch(/TestFlight|beta/i)
  })
})

describe('StationPage offers the CHS curve without fetching anything itself', () => {
  // What the Worker serves. Effects do not run here, which is the point: this
  // is the prerendered page, and it must carry no prediction whatever the
  // browser goes on to do with it.
  const html = renderToStaticMarkup(
    <StationPage station={dodd} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('serves no control for a request that has not started', () => {
    // The browser asks DFO on load, but only once it is a browser: the fetch
    // and every control belonging to it live behind an effect. So the page we
    // SERVE is the identity page #43 shipped. A reader with JS off, or one
    // whose hydration failed, must not be shown a Cancel button for a request
    // that is not happening, or told in the present tense about a fetch that
    // never started.
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/cancel|your browser/i)
  })

  it('still names the source of the numbers it does not have', () => {
    expect(html).toMatch(/Canadian Hydrographic Service/)
  })

  it('keeps the identity panel saying exactly what it said', () => {
    // #44: the panel claims coverage and a source and no mechanism, because
    // nothing published says which gates the app fits. Drawing a curve does
    // not relax that for the panel — only for the curve's own caption.
    expect(html).toContain('are based on Canadian Hydrographic Service data')
    expect(html).not.toContain('published by the Canadian Hydrographic Service')
  })

  it('prerenders no curve at all', () => {
    // The licensing rule, and the one that did not move: nothing we serve may
    // contain a CHS prediction. Fetching on load changes who starts the
    // request, not who serves the numbers.
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('published by the Canadian Hydrographic Service')
  })
})

describe('StationPage for a derived gate', () => {
  // chs-malibu-rapids has no CHS current station of its own: slack is the
  // reference port's high and low water plus a fixed lag. There is nothing to
  // fetch, so offering a button that could only fail is worse than offering
  // none.
  const malibu = {
    ...dodd,
    id: 'chs-malibu-rapids', slug: 'malibu-rapids', name: 'Malibu Rapids',
    region: 'Princess Louisa Inlet',
    latitude: 50.1626, longitude: -123.8515,
    derived: true,
  } satisfies ChsStation
  const html = renderToStaticMarkup(
    <StationPage station={malibu} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('starts no request, and offers no button it cannot honour', () => {
    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/cancel|your browser/i)
  })

  it('still names the water and offers the app', () => {
    expect(html).toContain('Malibu Rapids')
    expect(html).toMatch(/TestFlight|beta/i)
  })
})
