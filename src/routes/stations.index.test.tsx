import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Route } from './stations.index'

vi.mock('#/components/UpcomingEvents', () => ({ UpcomingEvents: () => <section>Upcoming Events marker</section> }))

it('leads the station directory with upcoming events before the station lists', () => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({ tide: { count: 1, href: '/tides/', top: [] }, current: { count: 1, href: '/currents/', top: [] } } as never)
  const Stations = Route.options.component!
  const html = renderToStaticMarkup(<Stations />)
  expect(html).toContain('Upcoming Events marker')
  expect(html.indexOf('Upcoming Events marker')).toBeLessThan(html.indexOf('Tide stations'))
})
