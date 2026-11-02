import { createFileRoute } from '@tanstack/react-router'
import boating from '../content/boating.md?raw'

export const Route = createFileRoute('/boating.md')({
  server: {
    handlers: {
      GET: () =>
        new Response(boating, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }),
    },
  },
})
