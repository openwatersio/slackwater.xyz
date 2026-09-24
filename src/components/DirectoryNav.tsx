import { TESTFLIGHT } from '#/lib/links'

export function DirectoryNav() {
  return (
    <nav aria-label="Site" className="mb-12 flex flex-wrap items-center justify-between gap-4">
      <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
        Slackwater
      </a>
      <div className="flex flex-wrap items-center gap-4">
        <a
          href="https://openwaters.io/tides/slackwater"
          className="text-sm text-sw-foam underline-offset-4 hover:underline"
        >
          Docs
        </a>
        <a
          href="https://github.com/openwatersio/slackwater"
          className="text-sm text-sw-foam underline-offset-4 hover:underline"
        >
          GitHub
        </a>
        <a
          href={TESTFLIGHT || '/'}
          className="rounded-full bg-sw-leaf px-4 py-2 text-sm font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          {TESTFLIGHT ? 'Get the beta on TestFlight' : 'About the Slackwater app'}
        </a>
      </div>
    </nav>
  )
}
