import { createFileRoute } from '@tanstack/react-router'
import { Directory, directoryHead, loadDirectory } from './-directory'

export const Route = createFileRoute('/currents/$')({
  loader: ({ params }) => loadDirectory('current', params._splat),
  head: ({ loaderData }) => directoryHead('current', loaderData),
  component: () => <Directory kind="current" page={Route.useLoaderData()} />,
})
