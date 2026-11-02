import { createFileRoute } from '@tanstack/react-router'
import kayak from '../content/kayak.md?raw'
import { SituationPage, situationHead } from '#/components/SituationPage'

export const Route = createFileRoute('/kayak')({
  head: () =>
    situationHead({
      path: '/kayak/',
      title: 'Tides and currents for sea kayakers · Slackwater',
      description:
        'Set the fastest current you will paddle in and see the slack windows on every pass. Free, offline at the launch, and on Apple Watch.',
    }),
  component: () => <SituationPage markdown={kayak} path="/kayak/" art="/shots/situations/kayak.webp" />,
})
