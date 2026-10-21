import { createFileRoute } from '@tanstack/react-router'
import { marked } from 'marked'
import support from '../content/support.md?raw'

const TITLE = 'Get help with Slackwater'
const DESCRIPTION = 'Answers about Slackwater downloads, offline use, stations and Premium, plus how to contact support.'
// Trailing slash is required: Workers Assets 307s /support -> /support/,
// and a canonical pointing at a redirect is a conflicting signal.
const CANONICAL = 'https://slackwater.xyz/support/'

export const Route = createFileRoute('/support')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/support.md' }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: Support,
})

function Support() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
        <a href="/support.md" className="hover:underline">
          Markdown
        </a>
      </nav>

      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:scroll-mt-8 [&_h2]:border-t [&_h2]:border-white/10 [&_h2]:pt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-sw-paper [&_p]:mt-4 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-6"
        dangerouslySetInnerHTML={{ __html: marked.parse(support, { async: false }) }}
      />
    </main>
  )
}
