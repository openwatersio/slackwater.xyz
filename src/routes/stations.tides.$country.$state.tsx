import { createFileRoute, notFound } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { placeIndex } from '#/lib/catalogue-server'
import { placeHead } from '#/lib/place-head'

export const Route = createFileRoute('/stations/tides/$country/$state')({
  loader: async ({ params }) => {
    const page = await placeIndex({
      data: { kind: 'tide', country: params.country, state: params.state },
    })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) =>
    placeHead('tide', loaderData, `/stations/tides/${params.country}/${params.state}/`),
  component: State,
})

function State() {
  const { name, up, rows, count } = Route.useLoaderData()
  return (
    <StationIndex
      kind="tide"
      title={name}
      up={up}
      rows={rows}
      lede={`${count.toLocaleString()} tide stations.`}
    />
  )
}
