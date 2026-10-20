import { createFileRoute } from '@tanstack/react-router'
import { marked } from 'marked'
import kayak from '../content/kayak.md?raw'
import { APP_STORE, REQUIREMENT } from '#/lib/links'

const TITLE = 'Tides and currents for sea kayakers · Slackwater'
const DESCRIPTION =
  'Set the fastest current you will paddle in and see the slack windows on every pass. Free, offline at the launch, and on Apple Watch.'
const CANONICAL = 'https://slackwater.xyz/kayak/'

export const Route = createFileRoute('/kayak')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/kayak.md' }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: Kayak,
})

function Kayak() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
        <a href="/kayak.md" className="hover:underline">
          Markdown
        </a>
      </nav>

      {/* The page's screenshots sit in its Markdown, so they cap at a phone's
          width and take the shots' rounded, shadowed frame. */}
      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_img]:mx-auto [&_img]:mt-4 [&_img]:max-h-[640px] [&_img]:max-w-[320px] [&_img]:rounded-[2rem] [&_img]:object-cover [&_img]:object-top [&_img]:shadow-2xl [&_img]:shadow-sw-navy-deep/60 [&_img]:ring-1 [&_img]:ring-white/10"
        dangerouslySetInnerHTML={{ __html: marked.parse(kayak, { async: false }) }}
      />

      <div className="mt-12">
        <a
          href={APP_STORE}
          className="inline-block rounded-full bg-sw-leaf px-6 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
        >
          Download on the App Store
        </a>
        <p className="mt-4 text-sm text-sw-steel">Free. No account, no ads. {REQUIREMENT}</p>
      </div>
    </main>
  )
}
