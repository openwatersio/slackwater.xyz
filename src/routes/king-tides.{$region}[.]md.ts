import { createFileRoute } from '@tanstack/react-router'
import { kingTidePage } from '#/lib/catalogue-server'
import { markdownResponse } from '#/lib/markdown-twins'

export const Route = createFileRoute('/king-tides/{$region}.md')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const page = await kingTidePage({ data: { slug: params.region } })
        return page ? markdownResponse(page.markdown) : new Response('Not found', { status: 404 })
      },
    },
  },
})
