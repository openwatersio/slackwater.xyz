import { createFileRoute } from '@tanstack/react-router'
import { kingTidePage } from '#/lib/catalogue-server'
import { markdownResponse } from '#/lib/markdown-twins'

export const Route = createFileRoute('/king-tides.md')({
  server: {
    handlers: {
      GET: async () => markdownResponse((await kingTidePage({ data: {} }))!.markdown),
    },
  },
})
