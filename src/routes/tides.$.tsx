import { createFileRoute } from '@tanstack/react-router'
import { Directory, directoryHead, loadDirectory } from './-directory'

export const Route = createFileRoute('/tides/$')({
  loader: ({ params }) => loadDirectory('tide', params._splat),
  head: ({ loaderData }) => directoryHead('tide', loaderData),
  component: () => <Directory kind="tide" page={Route.useLoaderData()} />,
})
