import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Slackwater — offline tide and current predictions' },
      {
        name: 'description',
        content:
          'Slack and max-current timing you can trust — offline, US and Canadian waters.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-sw-paper text-sw-ink font-sans antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
