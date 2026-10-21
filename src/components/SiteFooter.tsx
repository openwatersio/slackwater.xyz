import { APP_STORE_REVIEW } from '../lib/links'

const SOURCE = 'https://github.com/openwatersio/slackwater-ios'

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-5 pb-12 text-sm text-sw-steel sm:px-6 print:hidden">
      <div className="border-t border-white/10 pt-6">
        <p className="leading-relaxed">
          Predictions are not observations — conditions vary with weather and river flow.{' '}
          <strong className="font-semibold text-sw-foam">Not for navigation.</strong>
        </p>
        <nav aria-label="Footer" className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-x-8 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:py-2 [&_a]:text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel/50 [&_a]:underline-offset-4 [&_a:hover]:text-sw-paper [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_a:focus-visible]:outline-sw-leaf">
          {[
            {
              title: 'Explore',
              links: [
                ['Stations', '/stations/'],
                ['How tides work', '/learn/tides/'],
                ['What is slack water?', '/learn/slack-water/'],
              ],
            },
            {
              title: 'The app',
              links: [
                ['Pricing', '/pricing/'],
                ['Compare apps', '/compare/best-tide-and-current-apps-iphone/'],
                ['For tide pools', '/tide-pools/'],
                ['For sea kayakers', '/kayak/'],
                ['About Slackwater', '/about/'],
              ],
            },
            {
              title: 'Help',
              links: [
                ['Support', '/support/'],
                ['Contact', '/contact/'],
                ['Privacy policy', '/privacy/'],
              ],
            },
            {
              title: 'Tools & code',
              links: [
                ['OpenCPN database', '/opencpn/'],
                ['Source code', SOURCE],
                ['Developer docs', 'https://openwaters.io/tides/slackwater/'],
              ],
            },
          ].map(({ title, links }) => (
            <section key={title}>
              <h2 className="mb-2 text-base font-semibold text-sw-paper">{title}</h2>
              <ul>
                {links.map(([label, href]) => (
                  <li key={href}>
                    <a href={href}>
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <p className="mt-8 border-t border-white/10 pt-6">
          Has Slackwater helped you?{' '}
          <a href={APP_STORE_REVIEW} className="underline underline-offset-4 hover:text-sw-foam">
            Rate it on the App Store
          </a>{' '}
          or see{' '}
          <a href="/support/#help" className="underline underline-offset-4 hover:text-sw-foam">
            other ways to help
          </a>
          .
        </p>
        <p className="mt-4">
          Built by{' '}
          <a href="https://openwaters.io" className="underline underline-offset-4 hover:text-sw-foam">
            Open Waters
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
