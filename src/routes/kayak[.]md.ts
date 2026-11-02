import { createFileRoute } from '@tanstack/react-router'
import kayak from '../content/kayak.md?raw'

export const Route = createFileRoute('/kayak.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(kayak, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
