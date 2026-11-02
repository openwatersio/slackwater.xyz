import { createFileRoute } from '@tanstack/react-router'
import { TITLE } from '#/components/SlackWaterGuide'
import { slackGuideData } from '#/lib/catalogue-server'
import { markdownResponse, slackWaterMarkdown } from '#/lib/markdown-twins'

export const Route = createFileRoute('/learn/slack-water.md')({
  server: { handlers: { GET: async () => markdownResponse(slackWaterMarkdown(TITLE, await slackGuideData())) } },
})
