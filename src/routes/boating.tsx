import { createFileRoute } from '@tanstack/react-router'
import boating from '../content/boating.md?raw'
import { SituationPage, situationHead } from '#/components/SituationPage'

export const Route = createFileRoute('/boating')({
  head: () =>
    situationHead({
      path: '/boating/',
      title: 'Tides and currents with no signal, for boaters · Slackwater',
      description:
        'Slackwater predicts tides and currents on your phone, so the week ahead is there in the anchorage with no bars. Time a pass, read slack windows for your boat, and check it on Apple Watch.',
    }),
  component: () => <SituationPage markdown={boating} path="/boating/" art="/shots/situations/boat.webp" />,
})
