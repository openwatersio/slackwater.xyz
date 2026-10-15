import { createFileRoute } from '@tanstack/react-router'
import home from '../content/home.md?raw'

export const Route = createFileRoute('/index.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(home, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
