import { createFileRoute, notFound } from '@tanstack/react-router'
import { COMPARE_PAGES } from '#/lib/compare'
import { ComparePage } from '#/components/ComparePage'

// Trailing slash is required: Workers Assets 307s the bare path, and a
// canonical pointing at a redirect is a conflicting signal.
const page = (slug: string) => COMPARE_PAGES[`/alternatives/${slug}/`]

export const Route = createFileRoute('/alternatives/$slug')({
  loader: ({ params }) => {
    if (!page(params.slug)) throw notFound()
  },
  head: ({ params }) => {
    const p = page(params.slug)
    if (!p) return {}
    const canonical = `https://slackwater.xyz${p.path}`
    return {
      links: [{ rel: 'canonical', href: canonical }],
      meta: [
        { title: p.title },
        { name: 'description', content: p.description },
        { property: 'og:title', content: p.title },
        { property: 'og:description', content: p.description },
        { property: 'og:url', content: canonical },
      ],
    }
  },
  component: () => <ComparePage page={page(Route.useParams().slug)!} />,
})
