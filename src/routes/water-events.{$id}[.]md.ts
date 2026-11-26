import { createFileRoute } from '@tanstack/react-router'
import { EVENTS, eventMarkdown } from '#/lib/water-events'
import { markdownResponse } from '#/lib/markdown-twins'

export const Route = createFileRoute('/water-events/{$id}.md')({
  server: { handlers: { GET: ({ params }) => {
    const event = EVENTS.find((item) => item.id === params.id)
    return event ? markdownResponse(eventMarkdown(event)) : new Response('Not found', { status: 404 })
  } } },
})
