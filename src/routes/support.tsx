import { createFileRoute } from '@tanstack/react-router'

const SUPPORT_EMAIL = 'slackwater@openwaters.io'

export const Route = createFileRoute('/support')({
  head: () => ({
    meta: [
      { title: 'Support — Slackwater' },
      {
        name: 'description',
        content: 'How to get help with Slackwater, report a bug, or ask about a station.',
      },
    ],
  }),
  component: Support,
})

function Support() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
      </nav>

      <div className="mt-10 leading-relaxed text-sw-foam">
        <h1 className="border-b border-white/10 pb-8 text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
          Support
        </h1>

        <p className="mt-8">
          Email{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam"
          >
            {SUPPORT_EMAIL}
          </a>
          . A person reads it. Slackwater is in beta, so bug reports and "this station looks
          wrong" notes are genuinely useful.
        </p>

        <p className="mt-4">
          It helps to include your iOS version, the station name, and the date and time you were
          looking at.
        </p>

        <p className="mt-4">
          There are no accounts and nothing to reset — Slackwater keeps its data on your device.
          See the{' '}
          <a
            href="/privacy"
            className="underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam"
          >
            privacy policy
          </a>{' '}
          for what that means.
        </p>
      </div>
    </main>
  )
}
