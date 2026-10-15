import { createFileRoute } from '@tanstack/react-router'
import { stationsHub } from '#/lib/catalogue-server'
import { markdownResponse, stationsMarkdown } from '#/lib/markdown-twins'

export const Route = createFileRoute('/stations.md')({
  server: { handlers: { GET: async () => markdownResponse(stationsMarkdown(await stationsHub())) } },
})
