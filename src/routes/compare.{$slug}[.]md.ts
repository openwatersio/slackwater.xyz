import { createFileRoute } from '@tanstack/react-router'
import { COMPARE_PAGES } from '#/lib/compare'
import { compareMarkdown, markdownResponse } from '#/lib/markdown-twins'

export const Route = createFileRoute('/compare/{$slug}.md')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const page = COMPARE_PAGES[`/compare/${params.slug}/`]
        return page ? markdownResponse(compareMarkdown(page)) : new Response('Not found', { status: 404 })
      },
    },
  },
})
