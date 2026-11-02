import { createFileRoute } from '@tanstack/react-router'
import tidePools from '../content/tide-pools.md?raw'

export const Route = createFileRoute('/tide-pools.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(tidePools, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
