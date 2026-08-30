import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

/** Shared by the <title>, og:title and the app's JSON-LD. */
export const SITE_TITLE = 'Slackwater — Tides & Currents'

/** Shared by the meta description, og:description and the JSON-LD. */
export const SITE_DESCRIPTION =
  'All tide and current predictions, offline on your phone. Works on the water, on the beach, in the anchorage — no bars and nothing to load.'

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
          'The Slackwater mark: a tide curve crossing the datum line, with the slack marker on the crossing.',
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
})

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
