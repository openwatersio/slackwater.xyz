import { APP_STORE } from '#/lib/links'

export function DirectoryNav() {
  return (
    <nav aria-label="Site" className="mb-12 flex flex-wrap items-center justify-between gap-4">
      <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
        Slackwater
      </a>
      <a
        href={APP_STORE}
        className="rounded-full bg-sw-leaf px-4 py-2 text-sm font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
      >
        Download on the App Store
      </a>
    </nav>
  )
}
