import { createFileRoute } from '@tanstack/react-router'
import about from '../content/about.md?raw'

export const Route = createFileRoute('/about.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(about, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
