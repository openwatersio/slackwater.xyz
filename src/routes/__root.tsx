import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Slackwater — Tides & Currents' },
      { name: 'theme-color', content: '#00121f' },
      {
        name: 'description',
        content:
          'All tide and current predictions, offline on your phone. Works on the water, on the beach, in the anchorage — no bars and nothing to load.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
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
