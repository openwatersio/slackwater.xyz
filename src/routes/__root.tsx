import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

export const SITE_TITLE = 'Free Tide & Current App for iPhone — Slackwater'

/** Shared by the meta description, og:description and the JSON-LD. */
export const SITE_DESCRIPTION =
  'Free tide charts and tidal currents for iPhone. Bundled stations work offline; Canadian stations need setup, and some passes require a connection.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_TITLE },
      { name: 'theme-color', content: '#00121f' },
      { name: 'description', content: SITE_DESCRIPTION },

      // Unfurl card. Child routes override og:title/og:description by
      // property; every route sets its own og:url next to its canonical.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Slackwater' },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: 'https://slackwater.xyz/og.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content:
          'Slackwater showing Friday Harbor at low tide under a full moon, with the tide curve below.',
      },
      // Twitter falls back to the og: tags for everything but the card type.
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // Cut from the app's icon-1024.png (slackwater-ios AppIcon.appiconset) with
      // sips. Regenerate from that file if the app icon ever changes.
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    ],
    // Both paths are the first-party proxy rules in vite.config.ts, not plausible.io.
    scripts: [
      { src: '/js/script.js', defer: true, 'data-domain': 'slackwater.xyz', 'data-api': '/api/event' },
    ],
  }),
  shellComponent: RootDocument,
  // 1,048 of the 8,397 known station URLs still 404 by design: 1,047 Canadian
  // (CHS) tide ports whose identity nobody publishes, and
  // `chs-arran-rapids`, a gate excluded by name pending an owner decision.
  // `dodd-narrows`, the former flagship share case, resolves.
  // The router's default is a bare title, so the receiver of that link got a
  // blank page. Say what happened and give them a way onward.
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        Not published
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-snug text-sw-foam">
        There is no page here. If you followed a link to a station, that station isn't published
        yet — the site covers 7,349 US and Canadian stations, with more on the way.
      </p>
      <p className="mt-6">
        <a className="text-sw-leaf underline underline-offset-4" href="/">
          Slackwater — tides and currents
        </a>
      </p>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-sw-page text-sw-foam font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
