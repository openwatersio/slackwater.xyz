import { marked } from 'marked'
import type { ComparePage as Page } from '#/lib/compare'

/**
 * One rendering for every comparison page. Same shell as the privacy route:
 * a way home, then the markdown. The prose is the page; nothing here fetches.
 */
export function ComparePage({ page }: { page: Page }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
        <a href="/compare/best-tide-and-current-apps-iphone/" className="hover:underline">
          All comparisons
        </a>
      </nav>

      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_li]:mt-2 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-sw-leaf [&_strong]:font-semibold [&_strong]:text-sw-paper [&_table]:mt-6 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_th]:border-b [&_th]:border-white/10 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-mono [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-sw-leaf [&_td]:border-b [&_td]:border-white/5 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_img]:rounded-lg [&_img]:border [&_img]:border-sw-leaf/15"
        dangerouslySetInnerHTML={{ __html: marked.parse(page.markdown, { async: false }) }}
      />

      <p className="mt-16 border-t border-white/10 pt-6 text-sm text-sw-steel">
        Prices, versions and ratings are from the US App Store on the date each page was checked,
        and change without notice. Company and app names belong to their owners.
      </p>
    </main>
  )
}
