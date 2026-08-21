import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

// ponytail: deliberately a placeholder, not a first draft of the design.
// The page's job is conversion (README § What this is for); building it before
// the brand tokens and real screenshots exist would only be thrown away.
function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6">
      {/* The wordmark is one word and never breaks. In the app exactly one
          view may shrink rather than wrap, and it is this one — enforced there
          by SlackwaterTests/TypeScaleTests testOnlyTheWordmarkShrinks. */}
      <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-sw-paper">
        Slackwater
      </h1>
      <p className="mt-4 text-lg">
        Every tide and current prediction, already on your phone.
      </p>
      <p className="mt-8 text-sm text-sw-steel">Scaffold. Design pending.</p>
    </main>
  )
}
