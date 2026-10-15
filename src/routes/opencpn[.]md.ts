import { createFileRoute } from '@tanstack/react-router'
import { markdownResponse, opencpnMarkdown } from '#/lib/markdown-twins'

export const Route = createFileRoute('/opencpn.md')({
  server: { handlers: { GET: () => markdownResponse(opencpnMarkdown()) } },
})
