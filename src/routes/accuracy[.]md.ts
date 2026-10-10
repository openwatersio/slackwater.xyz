import { createFileRoute } from '@tanstack/react-router'
import accuracy from '../content/accuracy.md?raw'

export const Route = createFileRoute('/accuracy.md')({
  server: {
    handlers: {
      GET: () => new Response(accuracy, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      }),
    },
  },
})
