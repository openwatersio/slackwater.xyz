import { createFileRoute } from '@tanstack/react-router'
import tides from '../content/learn-tides.md?raw'
import { markdownResponse } from '#/lib/markdown-twins'

export const Route = createFileRoute('/learn/tides.md')({
  server: { handlers: { GET: () => markdownResponse(tides) } },
})
