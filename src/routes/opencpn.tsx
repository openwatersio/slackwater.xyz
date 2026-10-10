import { createFileRoute } from '@tanstack/react-router'
import { Marked } from 'marked'
import content from '../content/opencpn.md?raw'
import { TCD } from '#/lib/links'

const TITLE = 'Slackwater for OpenCPN — free tide and current data'
const DESCRIPTION =
  'Download the Slackwater station database as a TCD file for OpenCPN: 6,000+ tide stations and 2,400+ current stations, with install steps.'
const CANONICAL = 'https://slackwater.xyz/opencpn/'
const RELEASED = TCD.date
  ? new Date(
      `${TCD.date.slice(0, 4)}-${TCD.date.slice(4, 6)}-${TCD.date.slice(6)}T12:00:00Z`,
    ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : undefined

const PROSE =
  'leading-relaxed text-sw-foam [&_a]:underline [&_a]:decoration-sw-steel [&_a]:underline-offset-4 [&_a:hover]:decoration-sw-foam [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-sw-paper [&_h2]:mt-14 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-sw-paper [&_img]:mt-6 [&_img]:w-full [&_h3]:mt-8 [&_h3]:font-semibold [&_h3]:text-sw-paper [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-sw-leaf [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-sw-leaf [&_p]:mt-4 [&_li>p:first-child]:mt-0 [&_strong]:font-semibold [&_strong]:text-sw-paper [&_table]:mt-6 [&_table]:block [&_table]:overflow-x-auto sm:[&_table]:table sm:[&_table]:w-full sm:[&_table]:table-fixed [&_table]:text-sm [&_th]:border-b [&_th]:border-white/10 [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:font-mono [&_th]:text-[0.65rem] [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-sw-leaf [&_td]:border-b [&_td]:border-white/5 [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top'

// Headings get ids from their text so the install steps and the prose can link
// to each other. A local instance keeps the other Markdown pages unchanged.
const slug = (text: string) =>
  text.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const markdown = new Marked({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    },
  },
})

export const Route = createFileRoute('/opencpn')({
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
  component: OpenCPN,
})

function OpenCPN() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-10">
      <nav className="font-mono text-xs uppercase tracking-[0.14em] text-sw-leaf">
        <a href="/" className="hover:underline">← Slackwater</a>
      </nav>

      <header className="mt-12 grid gap-10 sm:mt-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center lg:gap-12">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-sw-paper sm:text-5xl">
            Slackwater for OpenCPN
          </h1>
          <p className="mt-5 text-lg leading-snug text-sw-foam">
            Global tide and current stations, curated for quality, in local chart datum, updated every
            month, as one free file for OpenCPN.
          </p>
          <a
            href={TCD.url}
            className="mt-8 inline-block rounded-full bg-sw-leaf px-8 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90"
          >
            Download
          </a>
          <p className="mt-3 text-sm text-sw-steel">
            {RELEASED && <>Updated {RELEASED}. </>}
            <a
              href="https://github.com/openwatersio/slackwater-database/releases"
              className="underline underline-offset-4 hover:text-sw-foam"
            >
              All releases
            </a>
          </p>
        </div>

        <figure className="m-0">
          <img
            src="/shots/opencpn/hero.webp"
            alt="Tide height bars and current arrows from Slackwater around the San Juan Islands in OpenCPN"
            width={1560}
            height={1021}
            fetchPriority="high"
            className="w-full"
          />
          <figcaption className="mt-2 text-center text-sm text-sw-steel">
            Tide and current stations around the San Juan Islands in OpenCPN 5.14.
          </figcaption>
        </figure>
      </header>

      <section className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <article className={PROSE}>
          <h2 id="install">Install it in OpenCPN</h2>
          <ol>
            <li>
              <p>
                Download the <a href={TCD.url}>latest <code>.tcd</code> file</a>.
              </p>
            </li>
            <li>
              <p>
                In OpenCPN, click the ⚙️ to open <strong>Options</strong> → <strong>Charts</strong> tab →{' '}
                <strong>Tides &amp; Currents</strong>.
              </p>
            </li>
            <li>
              <p>
                Click <strong>Add Dataset…</strong> and choose the Slackwater file.
              </p>
            </li>
            <li>
              <p>In <strong>Active Datasets</strong>, select the following <code>.tcd</code> files and click <strong>Remove Selected</strong> (<a href="#why-remove-opencpn-s-other-tcd-files">why?</a>):</p>

              <ul>
                <li><code>harmonics-dwf-20210110-free.tcd</code></li>
                <li><code>ticon-europe-global.tcd</code> (OpenCPN 5.14)</li>
              </ul>

              <p><small>Keep{' '}
                <code>HARMONICS_NO_US.IDX</code> for British Columbia and Bay of Fundy current
                stations (see <a href="#what-slackwater-lacks">What Slackwater lacks</a>). Where it
                overlaps Slackwater, OpenCPN shows the file listed first, so remove it and add it back
                from OpenCPN&rsquo;s <code>tcdata</code> folder to list it after Slackwater.</small></p>
            </li>
            <li>
              <p>
                Click <strong>Ok</strong>.
              </p>
            </li>
            <li>
              <p>
                Open the menu button (☰) in the lower-right corner of the chart and check{' '}
                <strong>Show Tide stations</strong> and <strong>Show Currents</strong>.
              </p>
            </li>
            <li>
              <p>
                Right-click a station icon and choose <strong>Show Tide Information</strong> or{' '}
                <strong>Show Current Information</strong> to see its graph.
              </p>
            </li>
          </ol>
          <p>
            To update, download the newest file, add it, and remove the old one. The date in the file
            name is the date of the database release.
          </p>
        </article>
        <figure className="m-0 mx-auto w-full max-w-md lg:mt-14">
          <img
            src="/shots/opencpn/options.webp"
            alt="OpenCPN's Options window on the Charts tab, Tides & Currents section, with the Slackwater file listed under Active Datasets"
            width={900}
            height={812}
            loading="lazy"
            className="w-full"
          />
          <img
            src="/shots/opencpn/chart-panel.webp"
            alt="OpenCPN's chart panel menu with Show Tide stations and Show Currents checked"
            width={420}
            height={601}
            loading="lazy"
            className="ml-auto mt-8 w-full max-w-[210px]"
          />
        </figure>
      </section>

      <article className={`max-w-3xl ${PROSE}`} dangerouslySetInnerHTML={{ __html: markdown.parse(content, { async: false }) }} />
    </main>
  )
}
