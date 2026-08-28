import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Policy — Slackwater' },
      {
        name: 'description',
        content: 'How Slackwater and slackwater.xyz handle data.',
      },
    ],
  }),
  component: PrivacyPolicy,
})

function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <a
        href="/"
        className="font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf hover:underline"
      >
        ← Slackwater
      </a>

      <header className="mt-10 border-b border-white/10 pb-8">
        <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
          Privacy policy
        </h1>
        <p className="mt-3 text-sm text-sw-steel">Effective August 28, 2026</p>
        <p className="mt-6 max-w-2xl leading-relaxed text-sw-foam">
          This policy covers the Slackwater iOS app and slackwater.xyz. Slackwater is operated by
          Open Water Software, LLC, doing business as Open Waters (&ldquo;Open Waters,&rdquo;
          &ldquo;we,&rdquo; or &ldquo;us&rdquo;).
        </p>
      </header>

      <section className="mt-8 rounded-lg border border-sw-leaf/20 bg-white/[0.04] p-6">
        <h2 className="text-xl font-semibold text-sw-paper">The short version</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-sw-foam marker:text-sw-leaf">
          <li>Slackwater has no user accounts, advertising, or third-party analytics.</li>
          <li>Your precise location stays on your device.</li>
          <li>Slackwater does not send us crash reports or usage data.</li>
          <li>We do not sell personal information or track you across apps or websites.</li>
          <li>
            Our hosting provider keeps short-lived technical request logs for security and
            reliability.
          </li>
        </ul>
      </section>

      <article className="mt-12 space-y-12 leading-relaxed text-sw-foam">
        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Location</h2>
          <p className="mt-4">
            If you grant location permission, Slackwater uses your location on your device to find
            nearby tide and current stations and show your position on the map. Open Waters does
            not receive or store your location. You can decline or revoke permission at any time
            in iOS Settings; search and browsing remain available.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Information on your device</h2>
          <p className="mt-4">
            Preferences, recent and selected stations, downloaded prediction data, and purchase
            entitlement status are stored on your device. They remain there until you change them
            or remove the app, subject to Apple&rsquo;s device backup settings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">iCloud favourites</h2>
          <p className="mt-4">
            When iCloud is available, Slackwater stores the identifiers and save times of your
            favourite stations in Apple&rsquo;s iCloud key-value storage so they can appear on your
            other devices. This does not create an Open Waters account. You can remove favourites
            in Slackwater or manage Slackwater&rsquo;s access to iCloud in your device settings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Purchases and TestFlight</h2>
          <p className="mt-4">
            Apple processes TestFlight participation and App Store purchases under Apple&rsquo;s
            privacy policy. Slackwater asks StoreKit only whether Apple has verified a qualifying
            purchase and keeps that entitlement status on your device. Open Waters does not
            receive your payment-card details.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Online requests from the app</h2>
          <p className="mt-4">
            Most predictions and map data are bundled with Slackwater. When online data is needed,
            the app may request Canadian tide or current predictions from the Canadian
            Hydrographic Service and map resources from Open Waters. Those services receive the
            information normally sent with an internet request, such as an IP address and
            technical request details. A request may identify the station or map area you selected,
            but Slackwater does not send your device&rsquo;s GPS coordinates with it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">The website</h2>
          <p className="mt-4">
            slackwater.xyz has no accounts, forms, advertising, analytics, or cookies. Cloudflare
            hosts the site and processes technical request information such as IP address, request
            URL, browser information, timestamps, and errors to deliver, secure, and diagnose the
            site. Worker logs are retained for no more than seven days. We do not use them to build
            profiles or track people across services.
          </p>
          <p className="mt-4">
            Links to TestFlight and other websites take you to services governed by their own
            privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Sharing and service providers</h2>
          <p className="mt-4">
            We do not sell personal information or share it for advertising. Providers processing
            data on our behalf must protect it consistently with this policy. Independent services
            such as Apple and the Canadian Hydrographic Service process your requests under their
            own terms and privacy policies. Information may be processed outside your province,
            state, or country where these providers operate.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Retention, deletion, and choices</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 marker:text-sw-leaf">
            <li>Revoke location permission in iOS Settings.</li>
            <li>Remove favourite stations in Slackwater or disable its iCloud access.</li>
            <li>Delete the app to remove its locally stored data from your device.</li>
            <li>Website request logs expire automatically within seven days.</li>
          </ul>
          <p className="mt-4">
            Because Open Waters does not maintain Slackwater user accounts, we generally have no
            account record to access, correct, or delete. Contact us if you have a privacy question
            or request.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Children</h2>
          <p className="mt-4">
            Slackwater is not directed to children under 13. We do not create age profiles or
            knowingly collect personal information from children.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Changes to this policy</h2>
          <p className="mt-4">
            We will post updates here and change the effective date above. If a material change
            affects how data is handled, we will provide notice in the app or on the website before
            it takes effect and request consent where required.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-sw-paper">Contact</h2>
          <p className="mt-4">
            Questions, concerns, or privacy requests:{' '}
            <a
              href="mailto:privacy@openwaters.io"
              className="underline decoration-sw-steel underline-offset-4 hover:decoration-sw-foam"
            >
              privacy@openwaters.io
            </a>
          </p>
        </section>
      </article>
    </main>
  )
}
