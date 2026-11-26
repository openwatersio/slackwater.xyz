import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FindWater, StationResults } from './FindWater'

it('offers explicit location and station search without requesting either on render', () => {
  const html = renderToStaticMarkup(<FindWater />)
  expect(html).not.toContain('Use my location')
  expect(html).toContain('Browse stations')
  expect(html).toContain('Location stays on your device')
  expect(html).not.toContain('Loading stations')
})

it('shows each station notice without requiring a disclosure', () => {
  const station = { id: 'test', kind: 'tide' as const, name: 'Test', path: '/tides/us/wa/test/', latitude: 0, longitude: 0, attribution: 0, predictions: true }
  const html = renderToStaticMarkup(<StationResults title="Tide stations" rows={[{ station, distance: 1 }]} attributions={['Required source notice']} location={true} />)
  expect(html).toContain('Required source notice')
  expect(html).not.toContain('<details')
})
