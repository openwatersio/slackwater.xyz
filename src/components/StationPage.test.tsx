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
