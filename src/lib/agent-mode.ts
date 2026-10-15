import { COMPARE_PATHS } from './compare'
import { ORGANIZATION_DESCRIPTION } from './json-ld'
import { APP_STORE, APP_STORE_ID, MINIMUM_IOS, TCD } from './links'

const ORIGIN = 'https://slackwater.xyz'

/** Each page with a Markdown twin, as [HTML path, Markdown path]. */
export const MARKDOWN_TWINS: [string, string][] = [
  ['/', '/index.md'],
  ...['/about/', '/contact/', '/pricing/', '/support/', '/privacy/', '/accuracy/', '/opencpn/', '/stations/', '/learn/tides/', '/learn/slack-water/', ...COMPARE_PATHS].map(
    (path): [string, string] => [path, `${path.slice(0, -1)}.md`],
  ),
]

/**
 * `/?mode=agent`: the homepage as data, for an agent deciding what this site
 * can do. Everything here is a public GET; there is no API to call and nothing
 * to authenticate. Claims stay inside what the HTML pages already say.
 */
export const AGENT_VIEW = {
  name: 'Slackwater',
  description:
    'Free, open-source tide and tidal current predictions for iPhone, iPad and Apple Watch. Tides worldwide; currents across the US and Canada. This website explains the app and publishes a page per station with computed predictions.',
  url: `${ORIGIN}/`,
  publisher: {
    name: 'Open Waters',
    legalName: 'Open Water Software LLC',
    description: ORGANIZATION_DESCRIPTION,
    url: 'https://openwaters.io/',
    email: 'slackwater@openwaters.io',
  },
  app: {
    platforms: [`iOS ${MINIMUM_IOS} or later`, `iPadOS ${MINIMUM_IOS} or later`, `watchOS ${MINIMUM_IOS} or later`],
    install: APP_STORE,
    appStoreId: APP_STORE_ID,
    price: 'Free. Optional Premium is described at /pricing/.',
    source: 'https://github.com/openwatersio/slackwater-ios',
  },
  authentication: {
    required: false,
    scheme: 'none',
    notes: 'No accounts, API keys or tokens. Every endpoint below is a public HTTP GET.',
  },
  capabilities: [
    'High and low tide times and heights for tide stations worldwide, with a 7-day table on each station page.',
    'Slack water and maximum flood and ebb times for tidal current stations in the US and Canada.',
    'Station pages by country and state or province, with nearby stations.',
    'Markdown versions of the product, policy, comparison and learning pages.',
    'A free tide and current station file for OpenCPN.',
  ],
  limitations: [
    'Predictions are computed from harmonic constituents and are not observations; weather and river flow change real conditions. Not for navigation.',
    'Canadian Hydrographic Service predictions load in the browser from DFO and are absent from raw HTML and Markdown.',
    'Station pages are HTML only. Find a station through /stations/ rather than guessing its URL.',
    'There is no search, booking or account API.',
  ],
  endpoints: [
    { method: 'GET', path: '/llms.txt', type: 'text/plain', description: 'Guidance for agents: when to use Slackwater and which page answers what.' },
    { method: 'GET', path: '/sitemap.xml', type: 'application/xml', description: 'Sitemap index of every indexable page.' },
    { method: 'GET', path: '/stations/', type: 'text/html', description: 'Station directory by country.' },
    { method: 'GET', path: '/tides/{country}/{subdivision}/', type: 'text/html', description: 'Tide stations in a state or province, for example /tides/us/wa/. Some countries have no subdivision level.' },
    { method: 'GET', path: '/tides/{country}/{subdivision}/{station}/', type: 'text/html', description: "A tide station's chart and 7-day table of highs and lows, for example /tides/us/wa/seattle/." },
    { method: 'GET', path: '/currents/{country}/{subdivision}/{station}/', type: 'text/html', description: "A current station's slack and maximum flood and ebb times, for example /currents/us/wa/deception-pass-narrows/." },
    { method: 'GET', path: '/{tides|currents}/{country}/{subdivision}/{station}/{instant}/', type: 'text/html', description: 'The station at one moment, where {instant} is local ISO 8601 to the minute with an offset, for example 2026-10-15T14:00-07:00.' },
    { method: 'GET', path: '/og/{tides|currents}/{station}.png', type: 'image/png', description: "A station's share card image." },
    { method: 'GET', path: '/{page}.md', type: 'text/markdown', description: 'The Markdown twin of a page, listed under markdown.' },
    { method: 'GET', path: TCD.url, type: 'application/octet-stream', description: 'The station database as an XTide/OpenCPN TCD file. Install steps at /opencpn/.' },
  ],
  markdown: {
    negotiation: 'Request a page below with Accept: text/markdown, or append .md to its path.',
    pages: MARKDOWN_TWINS.map(([html, markdown]) => ({ html, markdown })),
  },
  support: { url: `${ORIGIN}/support/`, email: 'slackwater@openwaters.io' },
}

export function agentModeResponse(method: string): Response {
  return new Response(method === 'HEAD' ? null : `${JSON.stringify(AGENT_VIEW, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // The homepage is the page to index; this is the same content as data.
      'X-Robots-Tag': 'noindex',
      Link: `<${ORIGIN}/>; rel="canonical", </llms.txt>; rel="describedby"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
