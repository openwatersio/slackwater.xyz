import { marked } from 'marked'
import { APP_STORE, REQUIREMENT } from '#/lib/links'

/** The head for a situation page: title, description, canonical and its
 *  Markdown twin, which serves the same source the page renders. */
export function situationHead({ path, title, description }: { path: string; title: string; description: string }) {
  const canonical = `https://slackwater.xyz${path}`
  return {
    links: [
      { rel: 'canonical', href: canonical },
      { rel: 'alternate', type: 'text/markdown', href: `${path.slice(0, -1)}.md` },
    ],
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
    ],
  }
}

/** A page written for one situation (kayaking a pass, a low-tide walk): its
 *  Markdown, an optional illustration above it, and the install button below.
 *
 *  The screenshots sit in the Markdown, so they cap at a phone's width and
 *  take the shots' rounded, shadowed frame. Two images in one paragraph are a
 *  pair, side by side from sm up: a setting beside the curve it changes, or a
 *  screen beside the sheet it opens. */
export function SituationPage({ markdown, path, art }: { markdown: string; path: string; art?: string }) {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <nav className="flex justify-between font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">
          ← Slackwater
        </a>
        <a href={`${path.slice(0, -1)}.md`} className="hover:underline">
          Markdown
        </a>
      </nav>

      {art && (
        <div className="mt-10 aspect-[4/3] overflow-hidden rounded-3xl ring-1 ring-white/10 sm:aspect-[16/9]">
          <img src={art} alt="" width={960} height={720} className="h-full w-full object-cover motion-safe:animate-drift" />
        </div>
      )}

      <article
        className="mt-10 leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h1]:border-b [&_h1]:border-white/10 [&_h1]:pb-8 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-5xl [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_img]:mx-auto [&_img]:mt-4 [&_img]:max-h-[640px] [&_img]:max-w-[320px] [&_img]:rounded-[2rem] [&_img]:object-cover [&_img]:object-top [&_img]:shadow-2xl [&_img]:shadow-sw-navy-deep/60 [&_img]:ring-1 [&_img]:ring-white/10 [&_p:has(>img+img)]:grid [&_p:has(>img+img)]:items-center [&_p:has(>img+img)]:gap-6 sm:[&_p:has(>img+img)]:grid-cols-2"
        dangerouslySetInnerHTML={{ __html: marked.parse(markdown, { async: false }) }}
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
