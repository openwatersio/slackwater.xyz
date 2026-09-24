import { createFileRoute, notFound } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { placeIndex } from '#/lib/catalogue-server'
import { placeHead } from '#/lib/place-head'

export const Route = createFileRoute('/stations/tides/$country/')({
  loader: async ({ params }) => {
    const page = await placeIndex({ data: { kind: 'tide', country: params.country } })
    // A country the catalogue does not have is a 404, not an empty page: the
    // route matches any segment, so without this every typo would render a
    // heading with nothing under it and return 200 to a crawler.
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => placeHead('tide', loaderData, `/stations/tides/${params.country}/`),
  component: Country,
})

function Country() {
  const { name, up, places, rows, count } = Route.useLoaderData()
  return (
    <StationIndex
      kind="tide"
      title={name}
      up={up}
      places={places}
      rows={rows}
      lede={`${count.toLocaleString()} tide stations.`}
    />
  )
}
