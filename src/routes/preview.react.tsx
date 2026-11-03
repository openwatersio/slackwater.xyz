import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { reactStation } from '#/lib/catalogue-server'

// Production builds omit the experiment and its map dependencies.
const Preview = import.meta.env.DEV
  ? lazy(() => import('#/components/ReactPreview').then((m) => ({ default: m.ReactPreview })))
  : undefined

export const Route = createFileRoute('/preview/react')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  ssr: !import.meta.env.DEV,
  validateSearch: (search: Record<string, unknown>) => ({
    kind: search.kind === 'current' ? ('current' as const) : ('tide' as const),
    id: typeof search.id === 'string' ? search.id : search.kind === 'current' ? 'noaa/PUG1701' : 'noaa/8410140',
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => reactStation({ data: deps }),
  head: () => ({
    meta: [{ title: 'Station components preview — Slackwater' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: () => {
    const item = Route.useLoaderData()
    return Preview ? (
      <Suspense fallback={<p className="p-8 text-sw-steel">Loading station…</p>}>
        <Preview item={item} />
      </Suspense>
    ) : null
  },
})
