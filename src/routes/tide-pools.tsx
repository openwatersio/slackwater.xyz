import { createFileRoute } from '@tanstack/react-router'
import tidePools from '../content/tide-pools.md?raw'
import { SituationPage, situationHead } from '#/components/SituationPage'

export const Route = createFileRoute('/tide-pools')({
  head: () =>
    situationHead({
      path: '/tide-pools/',
      title: 'Find the lowest daylight low · Slackwater',
      description:
        'Slackwater marks the lowest low of the fortnight and puts sunrise and sunset on the same timeline, so you can plan a tide-pool walk in daylight. Free, and it works with no signal.',
    }),
  component: () => <SituationPage markdown={tidePools} path="/tide-pools/" art="/shots/situations/tidepools.webp" />,
})
