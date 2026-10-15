import { createFileRoute } from '@tanstack/react-router'
import { marked } from 'marked'
import pricing from '../content/pricing.md?raw'

const TITLE = 'Slackwater Premium pricing'
const DESCRIPTION = 'One Slackwater Premium, two ways to pay: US$7.99 yearly or US$69.99 once. Widgets, alerts and calendars, with future Premium improvements included.'
// Trailing slash is required: Workers Assets 307s /pricing -> /pricing/,
// and a canonical pointing at a redirect is a conflicting signal.
const CANONICAL = 'https://slackwater.xyz/pricing/'

export const Route = createFileRoute('/pricing')({
  head: () => ({
    links: [{ rel: 'canonical', href: CANONICAL }, { rel: 'alternate', type: 'text/markdown', href: '/pricing.md' }],
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: CANONICAL },
    ],
  }),
  component: Pricing,
})

const PROSE = 'leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-sw-paper sm:[&_h2]:text-3xl [&_p]:mt-4 [&_p]:max-w-2xl'
const SCREENSHOTS: Record<string, { width: number; height: number }> = {
  '/shots/premium/lock-screen.webp': { width: 1080, height: 492 },
  '/shots/premium/alert.webp': { width: 1080, height: 424 },
  '/shots/premium/calendar.webp': { width: 1080, height: 368 },
}
const [introduction, ...sections] = pricing.trim().split(/(?=^## )/m)

function Pricing() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="flex items-center justify-between text-sm">
        <a href="/" className="whitespace-nowrap text-lg font-semibold tracking-tight text-sw-paper">
          Slackwater
        </a>
        <a href="/pricing.md" className="text-sw-steel underline underline-offset-4 hover:text-sw-foam">
          Markdown
        </a>
      </nav>

      <header
        className={`${PROSE} mt-12 max-w-3xl sm:mt-16 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h1]:tracking-tight [&_h1]:text-sw-paper sm:[&_h1]:text-6xl [&_p:first-of-type]:mt-6 [&_p:first-of-type]:text-xl sm:[&_p:first-of-type]:text-2xl [&_a]:font-medium [&_a]:text-sw-leaf`}
        dangerouslySetInnerHTML={{ __html: marked.parse(introduction, { async: false }) }}
      />

      {sections.map((section) => {
        const screenshot = section.match(/^!\[([^\]]+)\]\(([^)]+)\)$/m)
        if (screenshot) {
          const [, alt, src] = screenshot
          return (
            <section key={src} className="mt-14 grid items-center gap-7 sm:mt-20 sm:grid-cols-[0.9fr_1.1fr] sm:gap-12">
              <div
                className={PROSE}
                dangerouslySetInnerHTML={{ __html: marked.parse(section.replace(screenshot[0], ''), { async: false }) }}
              />
              <img src={src} alt={alt} {...SCREENSHOTS[src]} loading="lazy" className="w-full rounded-2xl" />
            </section>
          )
        }
        const payment = section.startsWith('## One Premium.')
        return (
          <section
            key={section.split('\n')[0]}
            id={payment ? 'payment' : undefined}
            className={payment
              ? `${PROSE} mt-20 scroll-mt-8 rounded-3xl bg-sw-canvas px-5 py-8 sm:px-10 sm:py-10 [&_table]:my-7 [&_table]:w-full [&_table]:table-fixed [&_th]:px-3 [&_th]:pb-4 [&_th]:text-left [&_th]:text-sw-paper [&_td]:border-t [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-4 [&_td]:align-top [&_td_strong]:text-xl [&_td_strong]:text-sw-paper sm:[&_td_strong]:text-3xl [&_p>a]:inline-flex [&_p>a]:rounded-full [&_p>a]:bg-sw-leaf [&_p>a]:px-6 [&_p>a]:py-3 [&_p>a]:font-medium [&_p>a]:text-sw-navy-deep [&_p>a]:no-underline [&_p>a:hover]:bg-sw-leaf/90`
              : `${PROSE} mt-14 border-t border-white/10 pt-8 sm:mt-16`}
            dangerouslySetInnerHTML={{ __html: marked.parse(section, { async: false }) }}
          />
        )
      })}
      <p className="mt-8 text-sm text-sw-steel">Examples captured from Slackwater. The app shows predictions, not observed conditions.</p>
    </main>
  )
}
