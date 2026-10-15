import { createFileRoute } from '@tanstack/react-router'
import contact from '../content/contact.md?raw'

export const Route = createFileRoute('/contact.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(contact, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
