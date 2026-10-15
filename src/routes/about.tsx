import { createFileRoute } from '@tanstack/react-router'
import { marked } from 'marked'
import about from '../content/about.md?raw'

const TITLE = 'About Slackwater'
const DESCRIPTION = 'Slackwater, its publisher Open Waters, coverage, offline setup and prediction limits.'
// Trailing slash is required: Workers Assets 307s /about -> /about/,
// and a canonical pointing at a redirect is a conflicting signal.
const CANONICAL = 'https://slackwater.xyz/about/'

export const Route = createFileRoute('/about')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/about.md' }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: About,
})

function About() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
        <a href="/about.md" className="hover:underline">
          Markdown
        </a>
      </nav>

      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_p]:mt-4"
        dangerouslySetInnerHTML={{ __html: marked.parse(about, { async: false }) }}
      />
    </main>
  )
}
