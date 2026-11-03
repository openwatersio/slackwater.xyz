import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createQueryClient, prefetchTideStation, SlackwaterProvider, TideStation } from '@slackwater/react'
import { createLocalDataSource } from './react-source'
import { getReactStation, listReactStations } from './react-catalogue'

afterEach(() => vi.restoreAllMocks())

it('renders the shared tide chart from locally prefetched predictions on the server', async () => {
  const now = Date.now()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const fetch = vi.spyOn(globalThis, 'fetch')
  const source = createLocalDataSource({ station: getReactStation, list: listReactStations }, 'test:ssr')
  const client = createQueryClient()
  await prefetchTideStation(client, source, 'noaa/9447130', { now, units: 'feet' })
  const html = renderToStaticMarkup(
    <SlackwaterProvider dataSource={source} queryClient={client} units="feet" locale="en-US">
      <TideStation id="noaa/9447130" />
    </SlackwaterProvider>,
  )
  expect(html).toContain('Seattle')
  expect(html).toContain('Tide timeline')
  expect(html).toContain('MLLW')
  expect(html).toContain('Slackwater database')
  expect(fetch).not.toHaveBeenCalled()
  client.clear()
})
