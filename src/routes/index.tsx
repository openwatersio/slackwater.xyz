import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

// ponytail: deliberately a placeholder, not a first draft of the design.
// The page's job is conversion (README § What this is for); building it before
// the brand tokens and real screenshots exist would only be thrown away.
function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Slackwater</h1>
      <p className="mt-4 text-lg text-sw-water">
        Slack and max-current timing you can trust — offline, US and Canadian waters.
      </p>
      <p className="mt-8 text-sm text-sw-deep/60">Scaffold. Design pending.</p>
    </main>
  )
}
