import Negotiator from 'negotiator'
import home from '../content/home.md?raw'
import about from '../content/about.md?raw'
import pricing from '../content/pricing.md?raw'
import contact from '../content/contact.md?raw'
import support from '../content/support.md?raw'
import privacy from '../content/privacy.md?raw'
import accuracy from '../content/accuracy.md?raw'
import learnTides from '../content/learn-tides.md?raw'
import kayak from '../content/kayak.md?raw'
import tidePools from '../content/tide-pools.md?raw'
import { agentModeResponse, MARKDOWN_TWINS } from './agent-mode'
import { COMPARE_PAGES } from './compare'
import { compareMarkdown, opencpnMarkdown } from './markdown-twins'

/**
 * Pages that answer `Accept: text/markdown`. A page whose Markdown is computed
 * from the catalogue (the slack-water guide, the station hub) has no `body`
 * here: its prerendered `.md` twin is fetched instead, so the Worker doesn't
 * recompute it and the two can't disagree.
 */
const BODIES: Record<string, string> = {
  '/': home,
  '/pricing/': pricing,
  '/about/': about,
  '/contact/': contact,
  '/support/': support,
  '/privacy/': privacy,
  '/accuracy/': accuracy,
  '/opencpn/': opencpnMarkdown(),
  '/kayak/': kayak,
  '/tide-pools/': tidePools,
  '/learn/tides/': learnTides,
  ...Object.fromEntries(Object.entries(COMPARE_PAGES).map(([path, page]) => [path, compareMarkdown(page)])),
}
const DOCUMENTS: Record<string, { body?: string; alternate: string }> = Object.fromEntries(
  MARKDOWN_TWINS.map(([path, alternate]) => [path, { body: BODIES[path], alternate }]),
)

const NOT_FOUND = `# Page not found

There is no published page at this URL. A station may not be published on this website yet.

- [Slackwater](https://slackwater.xyz/)
- [Station directory](https://slackwater.xyz/stations/)
- [Sitemap](https://slackwater.xyz/sitemap.xml)
- [Agent guidance](https://slackwater.xyz/llms.txt)
- [Support](https://slackwater.xyz/support/)
`

function varyAccept(headers: Headers) {
  const vary = headers.get('Vary')?.split(',').map((value) => value.trim()) ?? []
  if (!vary.some((value) => ['accept', '*'].includes(value.toLowerCase()))) vary.push('Accept')
  headers.set('Vary', vary.join(', '))
}

type Fetch = (request?: Request) => Promise<Response>

/**
 * A negotiated page reaches the Worker before the asset cache, and the
 * framework handler renders it again rather than serving the prerendered file.
 * That is free for most pages and 180 ms of prediction maths for the
 * slack-water guide, so prerendered files are served from `asset` first and
 * the framework only answers what isn't one.
 */
const prerendered = async (asset: Fetch | undefined, next: Fetch, request: Request) => {
  const file = await asset?.(request)
  if (file?.ok) return file
  await file?.body?.cancel()
  return next(request)
}

export async function agentResponse(request: Request, next: Fetch, asset?: Fetch): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return next()
  const url = new URL(request.url)
  const path = url.pathname
  if (path === '/' && url.searchParams.get('mode') === 'agent') return agentModeResponse(request.method)
  const document = DOCUMENTS[path.endsWith('/') ? path : `${path}/`]
  const negotiator = new Negotiator({ headers: { accept: request.headers.get('Accept') ?? '*/*' } })
  const type = negotiator.mediaType(['text/html; charset=utf-8', 'text/markdown; charset=utf-8'])?.split(';')[0]
  let response: Response
  if (document && !type) {
    response = new Response('Available representations: text/html, text/markdown.\n', {
      status: 406, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } else if (document && type === 'text/markdown') {
    response = document.body === undefined
      ? await prerendered(asset, next, new Request(new URL(document.alternate, url), { headers: { Accept: 'text/markdown' } }))
      : new Response(document.body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
  } else {
    response = document || path.endsWith('.md') ? await prerendered(asset, next, request) : await next()
  }
  // TanStack can reject Markdown before resolving whether the path exists.
  if (!document && type === 'text/markdown' && response.status === 406) {
    const headers = new Headers(request.headers)
    headers.set('Accept', 'text/html')
    const html = await next(new Request(request, { headers }))
    if (html.status === 404) {
      await response.body?.cancel()
      response = html
    } else {
      await html.body?.cancel()
    }
  }
  const missing = response.status === 404 && response.headers.get('Content-Type')?.includes('text/html')
  if (!document && !missing) return response
  if (missing && type === 'text/markdown') {
    response = new Response(NOT_FOUND, { status: 404, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
  }
  const headers = new Headers(response.headers)
  varyAccept(headers)
  // Validators from an HTML asset must never validate a different representation.
  if (type === 'text/markdown' || response.status === 406) headers.set('Cache-Control', 'no-store')
  const links = ['</llms.txt>; rel="describedby"']
  if (document) links.push(`<${document.alternate}>; rel="alternate"; type="text/markdown"`)
  headers.append('Link', links.join(', '))
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers })
}
