import { createFileRoute } from '@tanstack/react-router'
import policy from '../content/privacy.md?raw'

export const Route = createFileRoute('/privacy.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(policy, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
