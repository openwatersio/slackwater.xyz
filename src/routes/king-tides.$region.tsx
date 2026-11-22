import { createFileRoute, notFound } from '@tanstack/react-router'
import { SituationPage } from '#/components/SituationPage'
import { kingTidePage } from '#/lib/catalogue-server'
import { kingTidesHead } from './-king-tides'

export const Route = createFileRoute('/king-tides/$region')({
  loader: async ({ params }) => {
    const page = await kingTidePage({ data: { slug: params.region } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => kingTidesHead(loaderData),
  component: () => {
    const { markdown, path } = Route.useLoaderData()
    return <SituationPage markdown={markdown} path={path} />
  },
})
