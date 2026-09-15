import { createFileRoute } from '@tanstack/react-router'
import support from '../content/support.md?raw'

export const Route = createFileRoute('/support.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(support, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
