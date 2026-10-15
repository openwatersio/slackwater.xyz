import { createFileRoute } from '@tanstack/react-router'
import pricing from '../content/pricing.md?raw'

export const Route = createFileRoute('/pricing.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(pricing, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
