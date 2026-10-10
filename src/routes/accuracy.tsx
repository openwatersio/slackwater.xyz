import { createFileRoute } from '@tanstack/react-router'
import { marked } from 'marked'
import accuracy from '../content/accuracy.md?raw'

const TITLE = 'How we check predictions — Slackwater'
const DESCRIPTION = 'Dated tide and current validation samples, their sources, methods and limits.'
const CANONICAL = 'https://slackwater.xyz/accuracy/'

export const Route = createFileRoute('/accuracy')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: Accuracy,
})

function Accuracy() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">← Slackwater</a>
        <a href="/accuracy.md" className="hover:underline">Markdown</a>
      </nav>
      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_p]:mt-4 [&_table]:mt-5 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:text-sw-leaf [&_th]:font-medium [&_td]:border-t [&_td]:border-sw-steel/20 [&_td]:py-2 [&_td]:pr-3"
        dangerouslySetInnerHTML={{ __html: marked.parse(accuracy, { async: false }) }}
      />
    </main>
  )
}
